from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("BOOTSTRAP_ADMIN_EMAIL", "admin@underwriter.example")
os.environ.setdefault("BOOTSTRAP_ADMIN_PASSWORD", "admin12345")


@pytest.fixture(scope="session")
def _tmp_db_path() -> Iterator[str]:
    fd, path = tempfile.mkstemp(prefix="underwriter_test_", suffix=".db")
    os.close(fd)
    yield path
    try:
        os.remove(path)
    except OSError:
        pass


@pytest.fixture(scope="session")
def app(_tmp_db_path: str):
    os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_db_path}"

    from app.core.config import get_settings

    get_settings.cache_clear()  # type: ignore[attr-defined]

    from app.db import session as session_module

    test_engine = create_engine(
        os.environ["DATABASE_URL"],
        future=True,
        connect_args={"check_same_thread": False},
    )
    session_module.engine = test_engine
    session_module.SessionLocal = sessionmaker(
        bind=test_engine, autoflush=False, autocommit=False, expire_on_commit=False, future=True
    )

    from app.db.base import Base

    Base.metadata.create_all(bind=test_engine)

    from app.main import create_app

    return create_app()


@pytest.fixture()
def client(app) -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def admin_token(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@underwriter.example", "password": "admin12345"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


@pytest.fixture()
def auth_headers(admin_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}
