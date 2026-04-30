from pydantic import BaseModel, Field

from app.models.application import ApplicationStatus, LoanPurpose
from app.schemas.common import TimestampedModel


class ApplicationBase(BaseModel):
    purpose: LoanPurpose = LoanPurpose.PERSONAL
    requested_amount: float = Field(gt=0)
    term_months: int = Field(gt=0, le=600)
    annual_income: float = Field(ge=0)
    monthly_debt_payments: float = Field(ge=0)
    employment_status: str | None = None
    years_at_employer: float | None = Field(default=None, ge=0)
    credit_score: int | None = Field(default=None, ge=300, le=850)


class ApplicationCreate(ApplicationBase):
    applicant_id: str


class ApplicationUpdate(BaseModel):
    purpose: LoanPurpose | None = None
    requested_amount: float | None = Field(default=None, gt=0)
    term_months: int | None = Field(default=None, gt=0, le=600)
    annual_income: float | None = Field(default=None, ge=0)
    monthly_debt_payments: float | None = Field(default=None, ge=0)
    employment_status: str | None = None
    years_at_employer: float | None = Field(default=None, ge=0)
    credit_score: int | None = Field(default=None, ge=300, le=850)
    status: ApplicationStatus | None = None


class ApplicationRead(ApplicationBase, TimestampedModel):
    id: str
    applicant_id: str
    status: ApplicationStatus
