def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "version" in body


def test_root(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Underwriter API"


def test_login_with_bootstrap_admin(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@underwriter.example", "password": "admin12345"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]


def test_login_invalid(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@underwriter.example", "password": "wrong-password"},
    )
    assert resp.status_code == 401


def test_me_requires_auth(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_returns_user(client, auth_headers):
    resp = client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "admin@underwriter.example"
