def test_end_to_end_underwriting(client, auth_headers):
    applicant = client.post(
        "/api/v1/applicants",
        headers=auth_headers,
        json={
            "full_name": "Jane Doe",
            "email": "jane@example.com",
            "phone": "555-0100",
            "country": "US",
        },
    )
    assert applicant.status_code == 201, applicant.text
    applicant_id = applicant.json()["id"]

    application = client.post(
        "/api/v1/applications",
        headers=auth_headers,
        json={
            "applicant_id": applicant_id,
            "purpose": "personal",
            "requested_amount": 12000,
            "term_months": 36,
            "annual_income": 90000,
            "monthly_debt_payments": 500,
            "employment_status": "full_time",
            "years_at_employer": 4,
            "credit_score": 745,
        },
    )
    assert application.status_code == 201, application.text
    app_id = application.json()["id"]

    submitted = client.post(f"/api/v1/applications/{app_id}/submit", headers=auth_headers)
    assert submitted.status_code == 200
    assert submitted.json()["status"] == "submitted"

    evaluation = client.post(f"/api/v1/applications/{app_id}/evaluate", headers=auth_headers)
    assert evaluation.status_code == 200, evaluation.text
    body = evaluation.json()
    assert body["outcome"] in {
        "approved",
        "conditionally_approved",
        "refer",
        "declined",
    }
    assert "risk_score" in body
    assert "reasons" in body and isinstance(body["reasons"], list)

    decided = client.post(f"/api/v1/applications/{app_id}/decide", headers=auth_headers, json={})
    assert decided.status_code == 201, decided.text
    decision = decided.json()
    assert decision["outcome"] == body["outcome"]
    assert decision["application_id"] == app_id

    after = client.get(f"/api/v1/applications/{app_id}", headers=auth_headers)
    assert after.status_code == 200
    assert after.json()["status"] == "decisioned"

    decisions = client.get(f"/api/v1/applications/{app_id}/decisions", headers=auth_headers)
    assert decisions.status_code == 200
    assert len(decisions.json()) >= 1


def test_decline_low_credit(client, auth_headers):
    applicant = client.post(
        "/api/v1/applicants",
        headers=auth_headers,
        json={"full_name": "Lo Credit", "email": "lo@example.com"},
    ).json()
    application = client.post(
        "/api/v1/applications",
        headers=auth_headers,
        json={
            "applicant_id": applicant["id"],
            "purpose": "personal",
            "requested_amount": 5000,
            "term_months": 24,
            "annual_income": 40000,
            "monthly_debt_payments": 200,
            "credit_score": 540,
        },
    ).json()
    evaluation = client.post(
        f"/api/v1/applications/{application['id']}/evaluate", headers=auth_headers
    )
    assert evaluation.status_code == 200
    assert evaluation.json()["outcome"] == "declined"
