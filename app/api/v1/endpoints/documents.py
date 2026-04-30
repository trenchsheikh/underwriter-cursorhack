from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.document import DocumentType
from app.models.user import User, UserRole
from app.schemas.document import DocumentRead
from app.services import application_service, document_service

router = APIRouter(prefix="/applications/{application_id}/documents", tags=["documents"])


@router.post(
    "",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    application_id: str,
    file: UploadFile = File(...),
    type: DocumentType = Form(DocumentType.OTHER),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    application = application_service.get_application(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    try:
        return document_service.save_document(
            db, application_id=application_id, upload=file, doc_type=type
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("", response_model=list[DocumentRead])
def list_documents(
    application_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    application = application_service.get_application(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return document_service.list_documents(db, application_id)


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.ADMIN, UserRole.UNDERWRITER))],
)
def delete_document(application_id: str, document_id: str, db: Session = Depends(get_db)):
    application = application_service.get_application(db, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    documents = {d.id: d for d in document_service.list_documents(db, application_id)}
    document = documents.get(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    document_service.delete_document(db, document)
    return None
