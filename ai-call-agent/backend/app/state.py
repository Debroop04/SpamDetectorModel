"""Helpers for the app_state key/value table."""

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models import AppState


def get_state(db: Session, key: str, default: Any = None) -> Any:
    row = db.get(AppState, key)
    if row is None:
        return default
    try:
        return json.loads(row.value)
    except json.JSONDecodeError:
        return row.value


def set_state(db: Session, key: str, value: Any) -> None:
    row = db.get(AppState, key)
    encoded = json.dumps(value, default=str)
    if row is None:
        db.add(AppState(key=key, value=encoded))
    else:
        row.value = encoded
    db.commit()
