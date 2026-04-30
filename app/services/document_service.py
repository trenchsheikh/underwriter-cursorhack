from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.document import Document, DocumentType

_ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
    "application/octet-stream",
}
_MAX_BYTES = 25 * 1024 * 1024  # 25 MiB


def _ensure_upload_dir() -> Path:
    settings = get_settings()
    path = Path(settings.upload_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_document(
    db: Session,
    *,
    application_id: str,
    upload: UploadFile,
    doc_type: DocumentType,
) -> Document:
    if upload.content_type and upload.content_type not in _ALLOWED_CONTENT_TYPES:
        raise ValueError(f"unsupported content_type: {upload.content_type}")

    upload_dir = _ensure_upload_dir() / application_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}_{Path(upload.filename or 'file').name}"
    storage_path = upload_dir / safe_name

    size = 0
    with storage_path.open("wb") as out:
        while chunk := upload.file.read(1024 * 1024):
            size += len(chunk)
            if size > _MAX_BYTES:
                out.close()
                os.remove(storage_path)
                raise ValueError(f"file exceeds max size of {_MAX_BYTES} bytes")
            out.write(chunk)

    document = Document(
        application_id=application_id,
        type=doc_type,
        filename=upload.filename or safe_name,
        content_type=upload.content_type,
        size_bytes=size,
        storage_path=str(storage_path),
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def list_documents(db: Session, application_id: str) -> list[Document]:
    return (
        db.query(Document)
        .filter(Document.application_id == application_id)
        .order_by(Document.created_at.desc())
        .all()
    )


def delete_document(db: Session, document: Document) -> None:
    try:
        Path(document.storage_path).unlink(missing_ok=True)
    except OSError:
        pass
    db.delete(document)
    db.commit()
