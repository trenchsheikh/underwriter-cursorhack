from pydantic import BaseModel

from app.models.document import DocumentType
from app.schemas.common import TimestampedModel


class DocumentBase(BaseModel):
    type: DocumentType = DocumentType.OTHER
    filename: str
    content_type: str | None = None
    size_bytes: int = 0


class DocumentRead(DocumentBase, TimestampedModel):
    id: str
    application_id: str
    storage_path: str
