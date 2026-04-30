from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.application import Application, ApplicationStatus
from app.models.decision import Decision, DecisionOutcome
from app.models.user import User
from app.schemas.decision import DecisionDecideRequest
from app.services.underwriting.engine import EvaluationResult, evaluate_application
from app.services.underwriting.llm import enrich_narrative


def evaluate(application: Application) -> EvaluationResult:
    result = evaluate_application(application)
    result.narrative = enrich_narrative(application, result)
    return result


def record_decision(
    db: Session,
    *,
    application: Application,
    user: User | None,
    overrides: DecisionDecideRequest | None = None,
) -> Decision:
    result = evaluate(application)

    outcome: DecisionOutcome = result.outcome
    approved_amount = result.approved_amount
    apr = result.interest_rate_apr
    notes_suffix = ""

    if overrides:
        if overrides.override_outcome is not None:
            outcome = overrides.override_outcome
        if overrides.override_amount is not None:
            approved_amount = overrides.override_amount
        if overrides.override_apr is not None:
            apr = overrides.override_apr
        if overrides.notes:
            notes_suffix = f"\n\nUnderwriter notes:\n{overrides.notes}"

    decision = Decision(
        application_id=application.id,
        decided_by_user_id=user.id if user else None,
        outcome=outcome,
        risk_score=result.risk_score,
        approved_amount=approved_amount,
        interest_rate_apr=apr,
        reasons=result.reasons,
        narrative=(result.narrative or "") + notes_suffix,
    )
    db.add(decision)

    application.status = ApplicationStatus.DECISIONED
    db.commit()
    db.refresh(decision)
    return decision


def list_decisions(db: Session, application_id: str) -> list[Decision]:
    return (
        db.query(Decision)
        .filter(Decision.application_id == application_id)
        .order_by(Decision.created_at.desc())
        .all()
    )
