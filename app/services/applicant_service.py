from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.applicant import Applicant
from app.schemas.applicant import ApplicantCreate, ApplicantUpdate


def create_applicant(db: Session, data: ApplicantCreate) -> Applicant:
    applicant = Applicant(**data.model_dump())
    db.add(applicant)
    db.commit()
    db.refresh(applicant)
    return applicant


def get_applicant(db: Session, applicant_id: str) -> Applicant | None:
    return db.get(Applicant, applicant_id)


def list_applicants(db: Session, *, limit: int = 50, offset: int = 0) -> tuple[list[Applicant], int]:
    total = db.query(Applicant).count()
    rows = (
        db.execute(select(Applicant).order_by(Applicant.created_at.desc()).limit(limit).offset(offset))
        .scalars()
        .all()
    )
    return list(rows), total


def update_applicant(db: Session, applicant: Applicant, data: ApplicantUpdate) -> Applicant:
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(applicant, k, v)
    db.commit()
    db.refresh(applicant)
    return applicant


def delete_applicant(db: Session, applicant: Applicant) -> None:
    db.delete(applicant)
    db.commit()
