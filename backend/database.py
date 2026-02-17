import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

_ENV_DIR = os.path.dirname(__file__)
_ENV_PATH = os.path.join(_ENV_DIR, ".env")
_ENV_EXAMPLE_PATH = os.path.join(_ENV_DIR, ".env.example")

if os.path.exists(_ENV_PATH):
    load_dotenv(dotenv_path=_ENV_PATH)
else:
    load_dotenv(dotenv_path=_ENV_EXAMPLE_PATH)

DATABASE_URL = os.getenv("DATABASE_URL")

# Local dev convenience: if DATABASE_URL isn't set, fall back to a local SQLite DB.
# In production (Render), you should set DATABASE_URL to your managed Postgres instance.
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./swasthai.db"

# SQLAlchemy sync engine
# SQLite needs special connect args for multithreaded FastAPI usage.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite:") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
