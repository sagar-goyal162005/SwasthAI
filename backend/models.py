import json
import uuid
import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_input = Column(Text, nullable=False)
    ai_reply = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(64), unique=True, index=True, nullable=False, default=lambda: uuid.uuid4().hex)

    email = Column(String(256), unique=True, index=True, nullable=True)
    phone = Column(String(64), unique=True, index=True, nullable=True)

    name = Column(String(256), nullable=False, default="Wellness Seeker")
    age = Column(Integer, nullable=False, default=0)
    gender = Column(String(32), nullable=False, default="Prefer not to say")
    avatar_url = Column(Text, nullable=False, default="https://picsum.photos/seed/default-avatar/100/100")
    bio = Column(Text, nullable=True)

    password_hash = Column(Text, nullable=False)

    streak = Column(Integer, nullable=False, default=1)
    points = Column(Integer, nullable=False, default=0)
    daily_points = Column(Integer, nullable=False, default=0)
    last_activity_date = Column(String(16), nullable=False, default=lambda: datetime.date.today().isoformat())
    total_tasks_completed = Column(Integer, nullable=False, default=0)

    email_notifications = Column(Boolean, nullable=False, default=True)
    push_notifications = Column(Boolean, nullable=False, default=False)

    dosha = Column(String(16), nullable=True)
    dosha_is_balanced = Column(Boolean, nullable=False, default=False)

    buddy_persona_json = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_data = relationship("UserData", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def buddy_persona(self):
        if not self.buddy_persona_json:
            return None
        try:
            return json.loads(self.buddy_persona_json)
        except Exception:
            return None


class UserData(Base):
    __tablename__ = "user_data"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    challenges_json = Column(Text, nullable=False, default="[]")
    daily_vibes_json = Column(Text, nullable=False, default="[]")
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="user_data")

    def challenges(self):
        try:
            return json.loads(self.challenges_json or "[]")
        except Exception:
            return []

    def daily_vibes(self):
        try:
            return json.loads(self.daily_vibes_json or "[]")
        except Exception:
            return []


class Community(Base):
    __tablename__ = "communities"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(128), unique=True, index=True, nullable=False)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(64), unique=True, index=True, nullable=False, default=lambda: uuid.uuid4().hex)
    community_id = Column(Integer, ForeignKey("communities.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    content = Column(Text, nullable=False, default="")
    image_url = Column(Text, nullable=True)
    image_hint = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PostComment(Base):
    __tablename__ = "post_comments"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(64), unique=True, index=True, nullable=False, default=lambda: uuid.uuid4().hex)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
