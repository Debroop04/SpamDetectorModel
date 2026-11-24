"""Call Shield API."""

import asyncio
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import SessionLocal, ensure_schema
from app.events import broker
from app.routers import admin, app_api, auth, calls, events, me, numbers, public, reports, stations, stats, system, twilio_voice
from app.services import discovery, translator, twilio_service
from app.services.detector import seed_spam_numbers, spam_model

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger("twilio.http_client").setLevel(logging.WARNING)
logger = logging.getLogger("callshield")


def _startup_twilio_sync() -> None:
    db = SessionLocal()
    try:
        result = twilio_service.sync(db)
        if result["ok"]:
            logger.info("Twilio connected. Webhooks point to %s", result["base_url"])
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    broker.bind_loop(asyncio.get_running_loop())
    ensure_schema()
    db = SessionLocal()
    try:
        seeded = seed_spam_numbers(db)
        if seeded:
            logger.info("Seeded %d spam numbers from the ML team's CSV", seeded)
    finally:
        db.close()
    threading.Thread(target=spam_model.load, daemon=True).start()
    translator.warm_up()
    if settings.twilio_configured:
        threading.Thread(target=_startup_twilio_sync, daemon=True).start()
    await discovery.start()
    yield
    await discovery.stop()


app = FastAPI(title="Call Shield API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # The website opened from a phone or laptop on the same Wi-Fi (private network addresses).
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})(:\d+)?",
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

for module in (auth, me, stations, calls, reports, numbers, stats, system, events, twilio_voice, admin, app_api):
    app.include_router(module.router, prefix="/api")
app.include_router(public.router)
# The Android APK and version.json, so the app's update link works against the API address too.
app.mount("/downloads", StaticFiles(directory=settings.APK_DIR, check_dir=False), name="downloads")


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": spam_model.loaded}
