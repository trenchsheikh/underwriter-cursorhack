
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import engine
from app.models import user as user_model

log = get_logger(__name__)


def init_db() -> None:
    """Create all tables and bootstrap an initial admin user if absent."""
    Base.metadata.create_all(bind=engine)

    settings = get_settings()
    from app.db.session import SessionLocal

    with SessionLocal() as db:  # type: Session
        existing = db.query(user_model.User).first()
        if existing is not None:
            return
        admin = user_model.User(
            email=settings.bootstrap_admin_email,
            hashed_password=hash_password(settings.bootstrap_admin_password),
            full_name="Bootstrap Admin",
            role=user_model.UserRole.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        log.info("bootstrap_admin_created", email=admin.email)
