"""In-process publish/subscribe for Server-Sent Events, one channel per user."""

import asyncio
import json
import logging
from collections import defaultdict
from datetime import datetime
from typing import Any

logger = logging.getLogger("callshield.events")


def _encode(value: Any) -> str:
    if isinstance(value, datetime):
        return value.isoformat() + ("Z" if value.tzinfo is None else "")
    return str(value)


class EventBroker:
    def __init__(self) -> None:
        self._subscribers: dict[int, set[asyncio.Queue]] = defaultdict(set)
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def subscribe(self, user_id: int) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=200)
        self._subscribers[user_id].add(queue)
        return queue

    def unsubscribe(self, user_id: int, queue: asyncio.Queue) -> None:
        self._subscribers[user_id].discard(queue)
        if not self._subscribers[user_id]:
            self._subscribers.pop(user_id, None)

    def publish(self, user_id: int, event: str, data: dict[str, Any]) -> None:
        """Safe to call from the event loop or from worker threads."""
        message = json.dumps({"event": event, "data": data}, default=_encode)
        queues = list(self._subscribers.get(user_id, ()))
        if not queues:
            return
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        for queue in queues:
            if running is not None and running is self._loop:
                self._put(queue, message)
            elif self._loop is not None:
                self._loop.call_soon_threadsafe(self._put, queue, message)

    @staticmethod
    def _put(queue: asyncio.Queue, message: str) -> None:
        try:
            queue.put_nowait(message)
        except asyncio.QueueFull:
            logger.warning("Dropping event for a slow subscriber")


broker = EventBroker()
