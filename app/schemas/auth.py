from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole
from app.schemas.common import TimestampedModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    role: UserRole = UserRole.UNDERWRITER


class UserRead(TimestampedModel):
    id: str
    email: EmailStr
    full_name: str | None = None
    role: UserRole
    is_active: bool
