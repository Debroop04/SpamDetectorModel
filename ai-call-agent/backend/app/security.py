"""Password hashing, JWT tokens and the current-user dependency."""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(days=settings.ACCESS_TOKEN_DAYS)}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def user_from_token(token: str | None, db: Session) -> User:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    if not token:
        raise unauthorized
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized
    user = db.get(User, user_id)
    if not user:
        raise unauthorized
    return user


def _bearer(request: Request) -> str | None:
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return None


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    return user_from_token(_bearer(request), db)


def current_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins only")
    return user


def current_user_flexible(
    request: Request,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Accepts a bearer header or a ?token= query value (for EventSource and <audio> tags)."""
    return user_from_token(_bearer(request) or token, db)
