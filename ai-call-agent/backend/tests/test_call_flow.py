from app.models import Call, Report

LINE = "+15005550006"
SCAM = "Hello, I am calling from your bank. Your KYC has expired and your account will be blocked today. Tell me the OTP."
SAFE = "Hi, this is Rahul from college, calling about tomorrow's project meeting."
VAGUE = "Hello sir, I need to discuss something about your account."


def start(twilio, sid="CA1", caller="+919000011111", to=LINE, extra=None):
    form = {"CallSid": sid, "From": caller, "To": to, "CallStatus": "ringing"}
    form.update(extra or {})
    return twilio.post("/api/twilio/voice", form=form)


def call_row(db, sid="CA1") -> Call:
    db.expire_all()
    return db.query(Call).filter(Call.twilio_sid == sid).one()


def test_unsigned_webhook_is_rejected(account, twilio):
    response = twilio.post("/api/twilio/voice", form={"CallSid": "CA9", "From": "+919000011111", "To": LINE}, sign=False)
    assert response.status_code == 403


def test_unknown_line_hangs_up(twilio):
    response = start(twilio, to="+15550001111")
    assert response.status_code == 200
    assert "<Hangup" in response.text


def test_scam_call_is_blocked_and_reported(account, twilio, db, outbox):
    menu = start(twilio)
    assert "<Gather" in menu.text and 'numDigits="1"' in menu.text

    call = call_row(db)
    greeting = twilio.post("/api/twilio/language", params={"call": call.id}, form={"CallSid": "CA1", "Digits": "1"})
    assert 'input="speech"' in greeting.text
    assert 'language="en-IN"' in greeting.text

    result = twilio.post("/api/twilio/screen", params={"call": call.id, "turn": 1}, form={"CallSid": "CA1", "SpeechResult": SCAM, "Confidence": "0.91"})
    assert "<Hangup" in result.text
    assert "fraud" in result.text.lower()

    call = call_row(db)
    assert call.verdict == "spam"
    assert call.status == "blocked"
    assert call.category

    report = db.query(Report).one()
    assert report.status == "sent"
    assert report.mode == "test"
    assert report.station_name == "Connaught Place Police Station"
    assert report.sent_to == "asha@example.com"
    assert len(outbox) == 1
    mail = outbox[0]
    assert mail["subject"].startswith("[TEST]")
    assert mail["to"] == ["asha@example.com"]
    assert mail["attachments"][0][2] == "application/pdf"
    assert mail["attachments"][0][1].startswith(b"%PDF")
    assert "https://shield.example.com/r/" in mail["text"]


def test_safe_call_is_forwarded_with_whisper(account, twilio, db):
    start(twilio, sid="CA2")
    call = call_row(db, "CA2")
    twilio.post("/api/twilio/language", params={"call": call.id}, form={"CallSid": "CA2", "Digits": "1"})
    result = twilio.post("/api/twilio/screen", params={"call": call.id, "turn": 1}, form={"CallSid": "CA2", "SpeechResult": SAFE})
    assert "<Dial" in result.text
    assert "+919811122333" in result.text
    assert "/api/twilio/whisper" in result.text
    assert call_row(db, "CA2").caller_name == "Rahul"

    whisper = twilio.post("/api/twilio/whisper", params={"call": call.id}, form={"CallSid": "CA2-child"})
    assert "Rahul" in whisper.text

    done = twilio.post("/api/twilio/dial-result", params={"call": call.id}, form={"CallSid": "CA2", "DialCallStatus": "completed"})
    assert "<Hangup" in done.text
    twilio.post("/api/twilio/status", form={"CallSid": "CA2", "CallStatus": "completed", "CallDuration": "42"})
    call = call_row(db, "CA2")
    assert call.status == "connected"
    assert call.verdict == "safe"
    assert call.duration == 42
    assert call.ended_at is not None


def test_unanswered_safe_call_goes_to_voicemail(account, twilio, db):
    start(twilio, sid="CA3")
    call = call_row(db, "CA3")
    twilio.post("/api/twilio/language", params={"call": call.id}, form={"CallSid": "CA3", "Digits": "1"})
    twilio.post("/api/twilio/screen", params={"call": call.id, "turn": 1}, form={"CallSid": "CA3", "SpeechResult": SAFE})
    missed = twilio.post("/api/twilio/dial-result", params={"call": call.id}, form={"CallSid": "CA3", "DialCallStatus": "no-answer"})
    assert "<Record" in missed.text
    saved = twilio.post("/api/twilio/voicemail", params={"call": call.id}, form={"CallSid": "CA3", "RecordingSid": "RE123", "RecordingDuration": "12"})
    assert "<Hangup" in saved.text
    call = call_row(db, "CA3")
    assert call.recording_sid == "RE123"
    assert call.status == "voicemail"


def test_suspicious_caller_gets_follow_up_then_voicemail(account, twilio, db, outbox):
    start(twilio, sid="CA4")
    call = call_row(db, "CA4")
    twilio.post("/api/twilio/language", params={"call": call.id}, form={"CallSid": "CA4", "Digits": "1"})
    first = twilio.post("/api/twilio/screen", params={"call": call.id, "turn": 1}, form={"CallSid": "CA4", "SpeechResult": VAGUE})
    call = call_row(db, "CA4")
    if call.verdict == "suspicious":
        assert "turn=2" in first.text
        second = twilio.post("/api/twilio/screen", params={"call": call.id, "turn": 2}, form={"CallSid": "CA4", "SpeechResult": "It is regarding your bank account, please verify"})
        assert "<Record" in second.text or "<Hangup" in second.text
    else:
        assert call.verdict in ("safe", "spam")


def test_silent_caller_is_asked_again_then_sent_to_voicemail(account, twilio, db):
    start(twilio, sid="CA5")
    call = call_row(db, "CA5")
    twilio.post("/api/twilio/language", params={"call": call.id}, form={"CallSid": "CA5", "Digits": "1"})
    retry = twilio.post("/api/twilio/screen", params={"call": call.id, "turn": 1}, form={"CallSid": "CA5"})
    assert "retry=1" in retry.text
    final = twilio.post("/api/twilio/screen", params={"call": call.id, "turn": 1, "retry": 1}, form={"CallSid": "CA5"})
    assert "<Record" in final.text


def test_known_spam_number_is_blocked_immediately(account, twilio, db, outbox):
    response = start(twilio, sid="CA6", caller="+919876543210")
    assert "<Hangup" in response.text
    assert "<Gather" not in response.text
    call = call_row(db, "CA6")
    assert call.verdict == "spam"
    assert db.query(Report).count() == 1


def test_hindi_menu_choice_uses_hindi_speech(account, twilio, db):
    start(twilio, sid="CA7")
    call = call_row(db, "CA7")
    greeting = twilio.post("/api/twilio/language", params={"call": call.id}, form={"CallSid": "CA7", "Digits": "2"})
    assert 'language="hi-IN"' in greeting.text
    result = twilio.post(
        "/api/twilio/screen",
        params={"call": call.id, "turn": 1},
        form={"CallSid": "CA7", "SpeechResult": "मैं बैंक से बोल रहा हूँ, आपका खाता बंद हो जाएगा, ओटीपी बताइए"},
    )
    assert "<Hangup" in result.text
    assert call_row(db, "CA7").verdict == "spam"


def test_browser_call_uses_signed_in_user(account, twilio, db):
    user_id = account["user"]["id"]
    response = start(twilio, sid="CA8", caller=f"client:user-{user_id}", to="", extra={"callerNumber": "98765 00001"})
    assert "<Gather" in response.text
    call = call_row(db, "CA8")
    assert call.channel == "browser"
    assert call.caller_number == "+919876500001"


def test_personal_block_rule(account, twilio, client, db):
    client.put("/api/numbers/rules", json={"number": "+919000022222", "kind": "block"}, headers=account["headers"])
    response = start(twilio, sid="CA10", caller="+919000022222")
    assert "<Hangup" in response.text
    assert call_row(db, "CA10").category == "Blocked number"


def test_scam_caller_is_blocked_straight_away_next_time(account, twilio, db, outbox):
    start(twilio, sid="CA20", caller="+919000033333")
    call = call_row(db, "CA20")
    twilio.post("/api/twilio/language", params={"call": call.id}, form={"CallSid": "CA20", "Digits": "1"})
    twilio.post("/api/twilio/screen", params={"call": call.id, "turn": 1}, form={"CallSid": "CA20", "SpeechResult": SCAM})
    assert call_row(db, "CA20").verdict == "spam"

    again = start(twilio, sid="CA21", caller="+919000033333")
    assert "<Hangup" in again.text
    assert "<Gather" not in again.text
    assert call_row(db, "CA21").category == "Blocked number"
    assert db.query(Report).count() == 1


def test_trusted_number_rings_user_without_ai_speaking(account, twilio, client, db):
    client.put("/api/numbers/rules", json={"number": "+919000044444", "kind": "allow"}, headers=account["headers"])
    response = start(twilio, sid="CA22", caller="+919000044444")
    assert "<Dial" in response.text
    assert "+919811122333" in response.text
    assert "<Say" not in response.text
    assert "<Gather" not in response.text
    assert "whisper" not in response.text


def test_calls_api_lists_and_details(account, twilio, client, db, outbox):
    start(twilio, sid="CA11")
    call = call_row(db, "CA11")
    twilio.post("/api/twilio/language", params={"call": call.id}, form={"CallSid": "CA11", "Digits": "1"})
    twilio.post("/api/twilio/screen", params={"call": call.id, "turn": 1}, form={"CallSid": "CA11", "SpeechResult": SCAM})

    listing = client.get("/api/calls", headers=account["headers"]).json()
    assert listing["total"] == 1
    assert listing["items"][0]["verdict"] == "spam"
    assert listing["items"][0]["started_at"].endswith("Z")

    detail = client.get(f"/api/calls/{call.id}", headers=account["headers"]).json()
    assert [t["speaker"] for t in detail["turns"]][:2] == ["assistant", "caller"]
    assert detail["report"]["status"] == "sent"

    stats = client.get("/api/stats", headers=account["headers"]).json()
    assert stats["screened"] == 1
    assert stats["blocked"] == 1
    assert stats["reports_sent"] == 1
    assert len(stats["last_7_days"]) == 7
