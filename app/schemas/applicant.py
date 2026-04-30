from datetime import date

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import TimestampedModel


class ApplicantBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=50)
    date_of_birth: date | None = None
    ssn_last4: str | None = Field(default=None, min_length=4, max_length=4)
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = "US"


class ApplicantCreate(ApplicantBase):
    pass


class ApplicantUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    date_of_birth: date | None = None
    ssn_last4: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str | None = None


class ApplicantRead(ApplicantBase, TimestampedModel):
    id: str
