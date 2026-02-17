from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


Gender = Literal["Male", "Female", "Other", "Prefer not to say"]


class BuddyPersona(BaseModel):
    name: str
    age: int
    gender: str
    relationship: str


class UserOut(BaseModel):
    uid: str
    name: str
    age: int
    gender: Gender
    avatarUrl: str
    streak: int
    points: int
    dailyPoints: int
    lastActivityDate: str
    totalTasksCompleted: int
    bio: Optional[str] = None
    phone: Optional[str] = None
    buddyPersona: Optional[BuddyPersona] = None
    emailNotifications: Optional[bool] = True
    pushNotifications: Optional[bool] = False
    dosha: Optional[Literal["Vata", "Pitta", "Kapha"]] = None
    doshaIsBalanced: Optional[bool] = False


class AuthLoginIn(BaseModel):
    loginId: str
    password: str


class AuthSignupIn(BaseModel):
    name: str
    age: int = 0
    gender: Gender = "Prefer not to say"
    phone: str
    email: Optional[str] = None
    password: str
    avatarUrl: Optional[str] = None
    bio: Optional[str] = None
    dosha: Optional[Literal["Vata", "Pitta", "Kapha"]] = None
    doshaIsBalanced: Optional[bool] = False


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class AuthResolveLoginIn(BaseModel):
    loginId: str


class AuthResolveLoginOut(BaseModel):
    email: str


class UserBootstrapIn(BaseModel):
    """Profile payload after Firebase Auth is complete.

    The client authenticates via Firebase (email/password + phone OTP) and then
    calls /auth/bootstrap with a Firebase ID token to persist profile fields.
    """

    name: str
    age: int = 0
    gender: Gender = "Prefer not to say"
    phone: Optional[str] = None
    avatarUrl: Optional[str] = None
    bio: Optional[str] = None
    dosha: Optional[Literal["Vata", "Pitta", "Kapha"]] = None
    doshaIsBalanced: Optional[bool] = False


class UserPatchIn(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[Gender] = None
    avatarUrl: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    buddyPersona: Optional[BuddyPersona] = None
    emailNotifications: Optional[bool] = None
    pushNotifications: Optional[bool] = None
    dosha: Optional[Literal["Vata", "Pitta", "Kapha"]] = None
    doshaIsBalanced: Optional[bool] = None


class UserDataOut(BaseModel):
    challenges: list[Any] = Field(default_factory=list)
    dailyVibes: list[Any] = Field(default_factory=list)


class UserDataPutIn(BaseModel):
    challenges: list[Any] = Field(default_factory=list)
    dailyVibes: list[Any] = Field(default_factory=list)


class CommunityOut(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    memberCount: int = 0


class CommunityCreateIn(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None


class PostUserOut(BaseModel):
    uid: str
    name: str
    avatarUrl: str


class PostCommentOut(BaseModel):
    id: str
    user: PostUserOut
    content: str
    timestamp: str


class CommunityPostOut(BaseModel):
    id: str
    user: PostUserOut
    timestamp: str
    content: str
    imageUrl: Optional[str] = None
    imageHint: Optional[str] = None
    reactions: dict[str, int] = Field(default_factory=dict)
    userReactions: dict[str, str] = Field(default_factory=dict)
    comments: list[PostCommentOut] = Field(default_factory=list)


class CommunityPostCreateIn(BaseModel):
    content: str = ""
    imageUrl: Optional[str] = None
    imageHint: Optional[str] = None
    communitySlug: Optional[str] = None


class PostCommentCreateIn(BaseModel):
    content: str
