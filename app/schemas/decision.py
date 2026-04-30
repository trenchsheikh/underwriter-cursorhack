from typing import Any

from pydantic import BaseModel, Field

from app.models.decision import DecisionOutcome
from app.schemas.common import TimestampedModel


class DecisionRead(TimestampedModel):
    id: str
    application_id: str
    decided_by_user_id: str | None
    outcome: DecisionOutcome
    risk_score: float
    approved_amount: float | None
    interest_rate_apr: float | None
    reasons: Any | None
    narrative: str | None


class DecisionEvaluateResponse(BaseModel):
    """Preview of an underwriting evaluation prior to persistence."""

    outcome: DecisionOutcome
    risk_score: float
    approved_amount: float | None
    interest_rate_apr: float | None
    reasons: list[str]
    narrative: str | None = None


class DecisionDecideRequest(BaseModel):
    """Optional overrides when finalizing a decision."""

    override_outcome: DecisionOutcome | None = None
    override_amount: float | None = Field(default=None, ge=0)
    override_apr: float | None = Field(default=None, ge=0)
    notes: str | None = None
