"""Account management from the terminal.

    python -m app.cli create-user --name "Test User" --email test@example.com --password "Test@12345"
    python -m app.cli create-user --name "Super Admin" --email admin@example.com --password "Admin@12345" --admin
    python -m app.cli set-password --email test@example.com --password "New@12345"
"""

import argparse
import sys

from app.config import settings
from app.database import SessionLocal, ensure_schema
from app.models import User
from app.security import hash_password


def create_user(name: str, email: str, password: str, admin: bool) -> None:
    db = SessionLocal()
    try:
        email = email.lower().strip()
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(name=name, email=email, block_threshold=settings.DEFAULT_BLOCK_THRESHOLD)
            db.add(user)
        user.name = name
        user.password_hash = hash_password(password)
        user.role = "admin" if admin else "user"
        db.commit()
        print(f"{'Admin' if admin else 'User'} ready: {email}")
    finally:
        db.close()


def set_password(email: str, password: str) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email.lower().strip()).first()
        if user is None:
            sys.exit(f"No account with email {email}")
        user.password_hash = hash_password(password)
        db.commit()
        print(f"Password updated for {user.email}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)

    create = commands.add_parser("create-user", help="Create or update an account")
    create.add_argument("--name", required=True)
    create.add_argument("--email", required=True)
    create.add_argument("--password", required=True)
    create.add_argument("--admin", action="store_true", help="Give the account the super admin role")

    reset = commands.add_parser("set-password", help="Change an account's password")
    reset.add_argument("--email", required=True)
    reset.add_argument("--password", required=True)

    args = parser.parse_args()
    ensure_schema()
    if args.command == "create-user":
        if len(args.password) < 8:
            sys.exit("Password must be at least 8 characters")
        create_user(args.name, args.email, args.password, args.admin)
    else:
        set_password(args.email, args.password)


if __name__ == "__main__":
    main()
