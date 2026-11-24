"""Hindi to English translation for the English-only spam model.

Order of engines:
1. Local MarianMT (Helsinki-NLP/opus-mt-hi-en) when transformers and torch are installed.
2. The free MyMemory translation API.
3. The original text (phrase rules still cover Hindi and Hinglish).
"""

import logging
import re
import threading
from functools import lru_cache

import httpx

from app.config import settings

logger = logging.getLogger("callshield.translator")

_DEVANAGARI = re.compile(r"[ऀ-ॿ]")
_local_lock = threading.Lock()
_local = {"tokenizer": None, "model": None, "failed": False}


def has_devanagari(text: str) -> bool:
    return bool(_DEVANAGARI.search(text or ""))


def _load_local() -> bool:
    if settings.TRANSLATOR not in ("auto", "local") or _local["failed"]:
        return False
    with _local_lock:
        if _local["model"] is not None:
            return True
        try:
            from transformers import MarianMTModel, MarianTokenizer

            name = "Helsinki-NLP/opus-mt-hi-en"
            _local["tokenizer"] = MarianTokenizer.from_pretrained(name)
            _local["model"] = MarianMTModel.from_pretrained(name)
            logger.info("Local Hindi translator loaded")
            return True
        except Exception as exc:
            _local["failed"] = True
            logger.info("Local Hindi translator unavailable (%s); using online fallback", exc.__class__.__name__)
            return False


def _translate_local(text: str) -> str:
    tokenizer, model = _local["tokenizer"], _local["model"]
    tokens = tokenizer(text, return_tensors="pt", padding=True, truncation=True)
    output = model.generate(**tokens, max_new_tokens=256)
    return tokenizer.decode(output[0], skip_special_tokens=True)


def _translate_online(text: str) -> str:
    """MyMemory free API: no key needed, about 5000 characters per day per IP."""
    response = httpx.get(
        "https://api.mymemory.translated.net/get",
        params={"q": text[:480], "langpair": "hi|en"},
        headers={"User-Agent": settings.HTTP_USER_AGENT},
        timeout=6,
    )
    response.raise_for_status()
    data = response.json()
    if int(data.get("responseStatus", 200)) != 200:
        raise RuntimeError(data.get("responseDetails") or "translation quota reached")
    return data["responseData"]["translatedText"]


@lru_cache(maxsize=512)
def to_english(text: str) -> tuple[str, str]:
    """Return (english_text, engine). Engine is one of: none, local, online, failed."""
    if not text or not has_devanagari(text) or settings.TRANSLATOR == "off":
        return text, "none"
    if _load_local():
        try:
            return _translate_local(text), "local"
        except Exception as exc:
            logger.warning("Local translation failed: %s", exc)
    if settings.TRANSLATOR in ("auto", "online"):
        try:
            translated = _translate_online(text)
            if translated:
                return translated, "online"
        except Exception as exc:
            logger.warning("Online translation failed: %s", exc)
    return text, "failed"


def status() -> str:
    if settings.TRANSLATOR == "off":
        return "off"
    if _local["model"] is not None:
        return "local"
    return "online"


def warm_up() -> None:
    """Load the local model in the background so the first Hindi call is fast."""
    threading.Thread(target=_load_local, daemon=True).start()
