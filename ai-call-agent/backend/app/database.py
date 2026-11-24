"""Database engine, session factory and helpers."""

from collections.abc import Generator
from datetime import datetime, timezone

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False, "timeout": 15} if _is_sqlite else {},
    pool_pre_ping=True,
)

if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def ensure_schema() -> None:
    """Create tables and add columns introduced after a database was first created (SQLite has no migrations here)."""
    Base.metadata.create_all(bind=engine)
    added_columns = {"users": {"role": "VARCHAR(16) NOT NULL DEFAULT 'user'"}}
    with engine.begin() as connection:
        for table, columns in added_columns.items():
            existing = {row[1] for row in connection.exec_driver_sql(f"PRAGMA table_info({table})")} if _is_sqlite else set()
            for name, definition in columns.items():
                if _is_sqlite and name not in existing:
                    connection.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")


def utcnow() -> datetime:
    """Naive UTC timestamp. All stored datetimes are UTC."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
