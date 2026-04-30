from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.application import Application, ApplicationStatus
from app.schemas.application import ApplicationCreate, ApplicationUpdate


def create_application(db: Session, data: ApplicationCreate) -> Application:
    application = Application(**data.model_dump(), status=ApplicationStatus.DRAFT)
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


def get_application(db: Session, application_id: str) -> Application | None:
    return db.get(Application, application_id)


def list_applications(
    db: Session,
    *,
    applicant_id: str | None = None,
    status: ApplicationStatus | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Application], int]:
    q = select(Application)
    cq = db.query(Application)
    if applicant_id:
        q = q.where(Application.applicant_id == applicant_id)
        cq = cq.filter(Application.applicant_id == applicant_id)
    if status:
        q = q.where(Application.status == status)
        cq = cq.filter(Application.status == status)
    total = cq.count()
    rows = (
        db.execute(q.order_by(Application.created_at.desc()).limit(limit).offset(offset))
        .scalars()
        .all()
    )
    return list(rows), total


def update_application(db: Session, application: Application, data: ApplicationUpdate) -> Application:
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(application, k, v)
    db.commit()
    db.refresh(application)
    return application


def submit_application(db: Session, application: Application) -> Application:
    if application.status == ApplicationStatus.DRAFT:
        application.status = ApplicationStatus.SUBMITTED
        db.commit()
        db.refresh(application)
    return application


def delete_application(db: Session, application: Application) -> None:
    db.delete(application)
    db.commit()
