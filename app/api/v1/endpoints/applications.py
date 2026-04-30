from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.application import ApplicationStatus
from app.models.user import User, UserRole
from app.schemas.application import ApplicationCreate, ApplicationRead, ApplicationUpdate
from app.schemas.common import Page
from app.services import applicant_service, application_service

router = APIRouter(prefix="/applications", tags=["applications"])


@router.post(
    "",
    response_model=ApplicationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_application(
    payload: ApplicationCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if applicant_service.get_applicant(db, payload.applicant_id) is None:
        raise HTTPException(status_code=404, detail="Applicant not found")
    return application_service.create_application(db, payload)


@router.get("", response_model=Page[ApplicationRead])
def list_applications(
    applicant_id: str | None = None,
    status_: ApplicationStatus | None = Query(default=None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items, total = application_service.list_applications(
        db, applicant_id=applicant_id, status=status_, limit=limit, offset=offset
    )
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/{application_id}", response_model=ApplicationRead)
def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    application = application_service.get_application(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@router.patch("/{application_id}", response_model=ApplicationRead)
def update_application(
    application_id: str,
    payload: ApplicationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    application = application_service.get_application(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return application_service.update_application(db, application, payload)


@router.post("/{application_id}/submit", response_model=ApplicationRead)
def submit_application(
    application_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    application = application_service.get_application(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.status not in (ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED):
        raise HTTPException(status_code=409, detail=f"Cannot submit from status={application.status.value}")
    return application_service.submit_application(db, application)


@router.delete(
    "/{application_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def delete_application(application_id: str, db: Session = Depends(get_db)):
    application = application_service.get_application(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    application_service.delete_application(db, application)
    return None
