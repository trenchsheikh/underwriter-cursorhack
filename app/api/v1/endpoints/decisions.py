from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.decision import (
    DecisionDecideRequest,
    DecisionEvaluateResponse,
    DecisionRead,
)
from app.services import application_service, decision_service

router = APIRouter(prefix="/applications/{application_id}", tags=["decisions"])


@router.post("/evaluate", response_model=DecisionEvaluateResponse)
def evaluate_application(
    application_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    application = application_service.get_application(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    result = decision_service.evaluate(application)
    return DecisionEvaluateResponse(
        outcome=result.outcome,
        risk_score=result.risk_score,
        approved_amount=result.approved_amount,
        interest_rate_apr=result.interest_rate_apr,
        reasons=result.reasons,
        narrative=result.narrative,
    )


@router.post(
    "/decide",
    response_model=DecisionRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.UNDERWRITER))],
)
def decide_application(
    application_id: str,
    payload: DecisionDecideRequest | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    application = application_service.get_application(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return decision_service.record_decision(
        db, application=application, user=user, overrides=payload
    )


@router.get("/decisions", response_model=list[DecisionRead])
def list_decisions(
    application_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    application = application_service.get_application(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return decision_service.list_decisions(db, application_id)
