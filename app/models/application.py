import enum
import uuid

from sqlalchemy import Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class ApplicationStatus(enum.StrEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    IN_REVIEW = "in_review"
    DECISIONED = "decisioned"
    WITHDRAWN = "withdrawn"


class LoanPurpose(enum.StrEnum):
    PERSONAL = "personal"
    AUTO = "auto"
    HOME = "home"
    BUSINESS = "business"
    EDUCATION = "education"
    OTHER = "other"


class Application(Base, TimestampMixin):
    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    applicant_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("applicants.id", ondelete="CASCADE"), index=True, nullable=False
    )

    purpose: Mapped[LoanPurpose] = mapped_column(
        Enum(LoanPurpose, name="loan_purpose"), nullable=False, default=LoanPurpose.PERSONAL
    )
    requested_amount: Mapped[float] = mapped_column(Float, nullable=False)
    term_months: Mapped[int] = mapped_column(Integer, nullable=False, default=36)

    annual_income: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    monthly_debt_payments: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    employment_status: Mapped[str | None] = mapped_column(String(64), nullable=True)
    years_at_employer: Mapped[float | None] = mapped_column(Float, nullable=True)
    credit_score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[ApplicationStatus] = mapped_column(
        Enum(ApplicationStatus, name="application_status"),
        nullable=False,
        default=ApplicationStatus.DRAFT,
    )

    applicant = relationship("Applicant", back_populates="applications")
    documents = relationship(
        "Document", back_populates="application", cascade="all, delete-orphan"
    )
    decisions = relationship(
        "Decision",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="Decision.created_at.desc()",
    )
