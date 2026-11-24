import asyncio

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.events import broker
from app.models import User
from app.security import current_user_flexible

router = APIRouter(tags=["events"])

KEEPALIVE_SECONDS = 15


@router.get("/events")
async def events(request: Request, user: User = Depends(current_user_flexible)):
    """Server-Sent Events stream with live call and report updates for the signed-in user."""
    user_id = user.id
    queue = broker.subscribe(user_id)

    async def stream():
        try:
            yield 'data: {"event": "ready", "data": {}}\n\n'
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SECONDS)
                    yield f"data: {message}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            broker.unsubscribe(user_id, queue)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
