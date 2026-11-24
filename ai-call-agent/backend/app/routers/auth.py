from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import LoginIn, RegisterIn, SessionOut, UserOut
from app.security import create_access_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=SessionOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        name=body.name.strip(),
        email=email,
        password_hash=hash_password(body.password),
        block_threshold=settings.DEFAULT_BLOCK_THRESHOLD,
    )
    db.add(user)
    db.commit()
    return SessionOut(token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.post("/login", response_model=SessionOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return SessionOut(token=create_access_token(user.id), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user
