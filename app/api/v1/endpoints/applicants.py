from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.applicant import ApplicantCreate, ApplicantRead, ApplicantUpdate
from app.schemas.common import Page
from app.services import applicant_service

router = APIRouter(prefix="/applicants", tags=["applicants"])


@router.post(
    "",
    response_model=ApplicantRead,
    status_code=status.HTTP_201_CREATED,
)
def create_applicant(
    payload: ApplicantCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return applicant_service.create_applicant(db, payload)


@router.get("", response_model=Page[ApplicantRead])
def list_applicants(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items, total = applicant_service.list_applicants(db, limit=limit, offset=offset)
    return Page(items=items, total=total, limit=limit, offset=offset)


@router.get("/{applicant_id}", response_model=ApplicantRead)
def get_applicant(
    applicant_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    applicant = applicant_service.get_applicant(db, applicant_id)
    if applicant is None:
        raise HTTPException(status_code=404, detail="Applicant not found")
    return applicant


@router.patch("/{applicant_id}", response_model=ApplicantRead)
def update_applicant(
    applicant_id: str,
    payload: ApplicantUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    applicant = applicant_service.get_applicant(db, applicant_id)
    if applicant is None:
        raise HTTPException(status_code=404, detail="Applicant not found")
    return applicant_service.update_applicant(db, applicant, payload)


@router.delete(
    "/{applicant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN))],
)
def delete_applicant(applicant_id: str, db: Session = Depends(get_db)):
    applicant = applicant_service.get_applicant(db, applicant_id)
    if applicant is None:
        raise HTTPException(status_code=404, detail="Applicant not found")
    applicant_service.delete_applicant(db, applicant)
    return None
