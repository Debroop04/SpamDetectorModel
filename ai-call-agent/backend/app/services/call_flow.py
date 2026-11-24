"""Live call screening: TwiML for every step of a call and the decisions between them."""

import re
from dataclasses import dataclass, field
from urllib.parse import urlencode

from sqlalchemy.orm import Session
from twilio.twiml.voice_response import Gather, VoiceResponse

from app.config import settings
from app.database import utcnow
from app.events import broker
from app.formatting import display_number
from app.models import Call, CallTurn, NumberRule, User
from app.phone import normalize_number
from app.services import detector, reporting, translator
from app.services.public_url import public_base_url

SPEECH_HINTS = "OTP, KYC, bank, account, blocked, lottery, prize, AnyDesk, TeamViewer, police, CBI, customs, parcel, delivery, appointment, refund, loan"

PROMPTS = {
    "en": {
        "greeting": "You have reached {name}'s call assistant. Please say your name and the reason for your call.",
        "retry": "Sorry, I could not hear you. Please say your name and why you are calling.",
        "followup_1": "Thank you. Which company or organization are you calling from, and what exactly do you need?",
        "followup_2": "Is there anything else you would like me to pass on?",
        "connect": "Thank you. Please stay on the line while I connect you.",
        "voicemail": "{name} is not available right now. Please leave a short message after the beep.",
        "voicemail_done": "Thank you. Your message has been recorded. Goodbye.",
        "blocked_detected": "This call has been identified as a possible fraud and has been reported. Goodbye.",
        "blocked_known": "This number has been reported for fraud by other users. This call will now end.",
        "blocked_user": "The person you are calling is not accepting calls from this number. Goodbye.",
    },
    "hi": {
        "greeting": "आपने {name} के कॉल असिस्टेंट को कॉल किया है। कृपया अपना नाम और कॉल करने का कारण बताइए।",
        "retry": "माफ़ कीजिए, मैं सुन नहीं पाया। कृपया अपना नाम और कॉल करने का कारण बताइए।",
        "followup_1": "धन्यवाद। आप किस कंपनी या संस्था से बोल रहे हैं, और आपको क्या चाहिए?",
        "followup_2": "क्या आप कुछ और बताना चाहेंगे?",
        "connect": "धन्यवाद। कृपया लाइन पर बने रहें, मैं आपकी कॉल जोड़ रहा हूँ।",
        "voicemail": "{name} अभी उपलब्ध नहीं हैं। कृपया बीप के बाद अपना संदेश छोड़ें।",
        "voicemail_done": "धन्यवाद। आपका संदेश रिकॉर्ड हो गया है।",
        "blocked_detected": "इस कॉल को संभावित धोखाधड़ी के रूप में पहचाना गया है और इसकी रिपोर्ट कर दी गई है। धन्यवाद।",
        "blocked_known": "इस नंबर की धोखाधड़ी के लिए रिपोर्ट की गई है। यह कॉल अब समाप्त होगी।",
        "blocked_user": "आप जिन्हें कॉल कर रहे हैं, वे इस नंबर से कॉल स्वीकार नहीं कर रहे हैं। धन्यवाद।",
    },
}

_NAME_PATTERNS = [
    re.compile(r"\b(?:my name is|this is|i am|i'm|it's|its|mera naam|main)\s+([A-Za-z]+)(?:\s+([A-Za-z]+))?", re.IGNORECASE),
]
_NOT_NAMES = {
    "calling", "from", "the", "a", "an", "your", "here", "sir", "madam", "bank", "officer", "agent",
    "mom", "dad", "regarding", "about", "with", "speaking", "hai", "hoon", "bol", "and", "is", "not",
}


@dataclass
class FlowResult:
    twiml: str
    reports_to_deliver: list[int] = field(default_factory=list)


def first_name(user: User) -> str:
    return (user.name or "the owner").split()[0]


def prompt(lang: str, key: str, user: User | None = None) -> str:
    text = PROMPTS.get(lang, PROMPTS["en"])[key]
    return text.format(name=first_name(user)) if user else text


def twilio_url(path: str, **params) -> str:
    """Absolute webhook URL when a public URL is known (needed for REST call updates), else relative."""
    query = f"?{urlencode(params)}" if params else ""
    base = public_base_url() or ""
    return f"{base}/api/twilio/{path}{query}"


def _say(target, text: str, lang: str) -> None:
    target.say(text, voice=settings.TWILIO_VOICE, language="hi-IN" if lang == "hi" else "en-IN")


def call_summary(call: Call) -> dict:
    return {
        "id": call.id,
        "channel": call.channel,
        "caller_number": call.caller_number,
        "caller_name": call.caller_name,
        "status": call.status,
        "language": call.language,
        "verdict": call.verdict,
        "risk_score": call.risk_score,
        "category": call.category,
        "reasons": call.reasons or [],
        "turns_count": call.turns_count,
        "started_at": call.started_at,
        "ended_at": call.ended_at,
        "duration": call.duration,
        "has_recording": bool(call.recording_sid),
    }


def publish_call(call: Call, event: str = "call.updated") -> None:
    broker.publish(call.user_id, event, call_summary(call))


def add_turn(db: Session, call: Call, speaker: str, text: str, text_en: str | None = None, confidence: float | None = None) -> None:
    turn = CallTurn(speaker=speaker, text=text, text_en=text_en, confidence=confidence)
    call.turns.append(turn)
    db.commit()
    broker.publish(
        call.user_id,
        "call.turn",
        {"call_id": call.id, "speaker": speaker, "text": text, "text_en": text_en, "created_at": turn.created_at},
    )


def extract_name(text: str) -> str | None:
    for pattern in _NAME_PATTERNS:
        match = pattern.search(text)
        # Speech recognition capitalizes real names, so a lowercase word ("my", "home") is not a name.
        if not match or not match.group(1)[0].isupper() or match.group(1).lower() in _NOT_NAMES or len(match.group(1)) < 2:
            continue
        name = match.group(1).title()
        last = match.group(2)
        if last and last[0].isupper() and last.lower() not in _NOT_NAMES:
            name += f" {last.title()}"
        return name
    return None


# ---------- TwiML builders ----------


def language_menu_twiml(call: Call) -> str:
    response = VoiceResponse()
    gather = Gather(num_digits=1, timeout=6, action=twilio_url("language", call=call.id), method="POST")
    _say(gather, "Hello. This call is being screened by Call Shield. For English, press 1.", "en")
    _say(gather, "हिंदी के लिए 2 दबाइए।", "hi")
    response.append(gather)
    response.redirect(twilio_url("language", call=call.id, Digits="1"), method="POST")
    return str(response)


def speech_gather_twiml(call: Call, user: User, turn: int, key: str, retry: bool = False, intro: str | None = None) -> str:
    response = VoiceResponse()
    if intro:
        _say(response, intro, call.language)
    params = {"call": call.id, "turn": turn}
    if retry:
        params["retry"] = 1
    gather_kwargs = dict(
        input="speech",
        language="hi-IN" if call.language == "hi" else "en-IN",
        speech_timeout="auto",
        timeout=6,
        hints=SPEECH_HINTS,
        action=twilio_url("screen", **params),
        method="POST",
        action_on_empty_result=True,
    )
    if settings.TWILIO_SPEECH_MODEL:
        gather_kwargs["speech_model"] = settings.TWILIO_SPEECH_MODEL
    gather = Gather(**gather_kwargs)
    _say(gather, prompt(call.language, key, user), call.language)
    response.append(gather)
    return str(response)


def hangup_twiml(text: str, lang: str) -> str:
    response = VoiceResponse()
    _say(response, text, lang)
    response.hangup()
    return str(response)


def voicemail_twiml(call: Call, user: User) -> str:
    response = VoiceResponse()
    _say(response, prompt(call.language, "voicemail", user), call.language)
    response.record(max_length=60, play_beep=True, timeout=5, action=twilio_url("voicemail", call=call.id), method="POST")
    _say(response, prompt(call.language, "voicemail_done", user), call.language)
    response.hangup()
    return str(response)


def forward_twiml(call: Call, user: User, announce: bool = True, whisper: bool = True) -> str:
    if not user.phone:
        return voicemail_twiml(call, user)
    response = VoiceResponse()
    if announce:
        _say(response, prompt(call.language, "connect", user), call.language)
    dial = response.dial(
        timeout=20,
        action=twilio_url("dial-result", call=call.id),
        method="POST",
        caller_id=normalize_number(settings.TWILIO_PHONE_NUMBER) or None,
    )
    if whisper:
        dial.number(user.phone, url=twilio_url("whisper", call=call.id), method="POST")
    else:
        dial.number(user.phone)
    return str(response)


def block_number_for_user(db: Session, user: User, number: str) -> None:
    """After a scam call, the same number is blocked for this user without any screening."""
    if not number.startswith("+"):
        return
    rule = db.query(NumberRule).filter_by(user_id=user.id, number=number).first()
    if rule is None:
        db.add(NumberRule(user_id=user.id, number=number, kind="block"))
        db.commit()
    elif rule.kind != "block":
        rule.kind = "block"
        db.commit()


def whisper_twiml(call: Call) -> str:
    who = call.caller_name or "an unknown caller"
    digits = re.sub(r"\D", "", call.caller_number)[-10:]
    spoken_number = " ".join(digits) if digits else "a hidden number"
    first_caller_line = next((t.text_en or t.text for t in call.turns if t.speaker == "caller"), "")
    response = VoiceResponse()
    message = f"Call Shield. Screened call from {who}, number {spoken_number}."
    if first_caller_line.isascii() and first_caller_line:
        message += f" They said: {first_caller_line[:160]}."
    message += " Connecting now."
    _say(response, message, "en")
    return str(response)


# ---------- Flow steps ----------


def _finish_as_spam(db: Session, call: Call, user: User, source: str) -> list[int]:
    """Mark a call as spam, update community reputation and open a police report if enabled."""
    call.status = "blocked"
    call.verdict = "spam"
    db.commit()
    publish_call(call)
    if call.caller_number and call.caller_number.startswith("+"):
        reporting.record_number_report(db, user, call.caller_number, call.category or "Scam call", call_id=call.id, source="auto")
        block_number_for_user(db, user, call.caller_number)
    if not (user.auto_report or source == "user"):
        return []
    caller_lines = [t.text_en or t.text for t in call.turns if t.speaker == "caller"]
    summary = (
        f"Call from {display_number(call.caller_number)} was blocked as {call.category or 'a scam call'}. "
        + (f'The caller said: "{caller_lines[0][:240]}"' if caller_lines else "The number is known for fraud.")
    )
    report, created = reporting.create_report(
        db,
        user,
        caller_number=call.caller_number,
        category=call.category or "Scam call",
        summary=summary,
        source=source,
        call=call,
        risk_score=call.risk_score,
    )
    return [report.id] if created else []


def start_call(db: Session, user: User, call: Call) -> FlowResult:
    """First webhook of a call: personal rules, known spam numbers, then the language menu."""
    publish_call(call, "call.started")
    number = call.caller_number
    rule = db.query(NumberRule).filter_by(user_id=user.id, number=number).first() if number.startswith("+") else None

    if rule and rule.kind == "block":
        call.category = "Blocked number"
        call.reasons = ["This number is on your block list, so the call was ended without screening."]
        call.risk_score = 1.0
        call.status, call.verdict = "blocked", "spam"
        db.commit()
        publish_call(call)
        return FlowResult(hangup_twiml(prompt("en", "blocked_user"), "en"))

    if rule and rule.kind == "allow":
        call.verdict = "safe"
        call.reasons = ["This number is on your trusted list."]
        call.status = "forwarding"
        db.commit()
        publish_call(call)
        # Trusted callers go straight to the user: the AI does not speak at all.
        return FlowResult(forward_twiml(call, user, announce=False, whisper=False))

    reputation = detector.get_reputation(db, number)
    rep_score = detector.reputation_score(reputation.reports) if reputation else 0.0
    if reputation and rep_score >= settings.INSTANT_BLOCK_REPUTATION:
        call.risk_score = round(rep_score, 3)
        call.category = reputation.category
        call.reasons = [f"This number has {reputation.reports} spam reports ({reputation.category})."]
        call.signals = {"reputation_score": rep_score, "reputation_reports": reputation.reports}
        db.commit()
        reports = _finish_as_spam(db, call, user, source="auto")
        return FlowResult(hangup_twiml(prompt("en", "blocked_known"), "en"), reports)

    if user.language in ("en", "hi"):
        return choose_language(db, call, user, "1" if user.language == "en" else "2")
    return FlowResult(language_menu_twiml(call))


def choose_language(db: Session, call: Call, user: User, digits: str | None) -> FlowResult:
    call.language = "hi" if (digits or "").strip() == "2" else "en"
    db.commit()
    add_turn(db, call, "assistant", prompt(call.language, "greeting", user))
    return FlowResult(speech_gather_twiml(call, user, turn=1, key="greeting"))


def handle_speech(
    db: Session,
    call: Call,
    user: User,
    speech: str | None,
    confidence: float | None,
    turn: int,
    retry: bool,
) -> FlowResult:
    speech = (speech or "").strip()
    if call.status != "screening":
        return FlowResult(hangup_twiml("Goodbye.", call.language))

    if not speech:
        if not retry:
            add_turn(db, call, "assistant", prompt(call.language, "retry", user))
            return FlowResult(speech_gather_twiml(call, user, turn=turn, key="retry", retry=True))
        call.verdict = "suspicious"
        call.category = "No response"
        call.reasons = ["The caller did not answer the screening questions."]
        call.status = "voicemail"
        db.commit()
        publish_call(call)
        return FlowResult(voicemail_twiml(call, user))

    english, _engine = translator.to_english(speech) if call.language == "hi" else (speech, "none")
    add_turn(db, call, "caller", speech, english if english != speech else None, confidence)
    if not call.caller_name:
        call.caller_name = extract_name(english) or extract_name(speech)
    call.turns_count = turn

    caller_turns = [t for t in call.turns if t.speaker == "caller"]
    result = detector.evaluate(
        db,
        call.caller_number,
        texts=[t.text for t in caller_turns],
        texts_en=[t.text_en or t.text for t in caller_turns],
        block_threshold=user.block_threshold,
    )
    call.risk_score = result.score
    call.verdict = result.verdict
    call.category = result.category
    call.reasons = result.reasons
    call.signals = result.signals()
    db.commit()
    publish_call(call)

    if result.verdict == "spam":
        reports = _finish_as_spam(db, call, user, source="auto")
        text = prompt(call.language, "blocked_detected")
        add_turn(db, call, "assistant", text)
        return FlowResult(hangup_twiml(text, call.language), reports)

    if result.verdict == "suspicious":
        if turn < settings.MAX_SCREENING_TURNS:
            key = f"followup_{min(turn, 2)}"
            add_turn(db, call, "assistant", prompt(call.language, key, user))
            return FlowResult(speech_gather_twiml(call, user, turn=turn + 1, key=key))
        call.status = "voicemail"
        db.commit()
        publish_call(call)
        add_turn(db, call, "assistant", prompt(call.language, "voicemail", user))
        return FlowResult(voicemail_twiml(call, user))

    call.status = "forwarding" if user.phone else "voicemail"
    db.commit()
    publish_call(call)
    add_turn(db, call, "assistant", prompt(call.language, "connect" if user.phone else "voicemail", user))
    return FlowResult(forward_twiml(call, user))


def handle_dial_result(db: Session, call: Call, user: User, dial_status: str | None) -> FlowResult:
    if dial_status == "completed":
        call.status = "connected"
        db.commit()
        publish_call(call)
        response = VoiceResponse()
        response.hangup()
        return FlowResult(str(response))
    call.status = "voicemail"
    db.commit()
    publish_call(call)
    return FlowResult(voicemail_twiml(call, user))


def handle_recording(db: Session, call: Call, recording_sid: str | None, duration: str | None) -> FlowResult:
    if recording_sid:
        call.recording_sid = recording_sid
        call.recording_duration = int(duration or 0)
        db.commit()
        publish_call(call)
    return FlowResult(hangup_twiml(prompt(call.language, "voicemail_done"), call.language))


FINAL_STATUSES = {"completed", "busy", "failed", "no-answer", "canceled"}


def handle_status(db: Session, call: Call, call_status: str, duration: str | None) -> None:
    if call_status not in FINAL_STATUSES:
        return
    if call.status == "screening":
        call.status = "ended"
    elif call.status == "forwarding" or (call.status == "voicemail" and not call.recording_sid):
        call.status = "missed"
    call.ended_at = call.ended_at or utcnow()
    call.duration = int(duration or 0) or call.duration
    db.commit()
    publish_call(call, "call.ended")


def block_live_call(db: Session, call: Call, user: User) -> list[int]:
    """User pressed Block and report while the call was still being screened."""
    call.category = call.category or "Reported by you"
    call.reasons = (call.reasons or []) + ["You blocked this call during screening."]
    db.commit()
    return _finish_as_spam(db, call, user, source="user")
