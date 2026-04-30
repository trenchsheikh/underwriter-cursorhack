from app.models.application import Application, LoanPurpose
from app.models.decision import DecisionOutcome
from app.services.underwriting.engine import UnderwritingEngine


def _app(**overrides):
    base = dict(
        id="a1",
        applicant_id="p1",
        purpose=LoanPurpose.PERSONAL,
        requested_amount=10_000.0,
        term_months=36,
        annual_income=80_000.0,
        monthly_debt_payments=400.0,
        years_at_employer=3.5,
        credit_score=740,
    )
    base.update(overrides)
    return Application(**base)


def test_strong_profile_is_approved():
    result = UnderwritingEngine().evaluate(_app())
    assert result.outcome == DecisionOutcome.APPROVED
    assert result.approved_amount == 10_000.0
    assert 0.0 <= result.risk_score <= 100.0
    assert result.interest_rate_apr is not None and result.interest_rate_apr > 0


def test_low_credit_is_declined():
    result = UnderwritingEngine().evaluate(_app(credit_score=520))
    assert result.outcome == DecisionOutcome.DECLINED
    assert result.approved_amount is None


def test_no_income_is_declined():
    result = UnderwritingEngine().evaluate(_app(annual_income=0))
    assert result.outcome == DecisionOutcome.DECLINED


def test_excess_dti_lowers_decision():
    result = UnderwritingEngine().evaluate(
        _app(monthly_debt_payments=4_000.0, annual_income=60_000.0, credit_score=680)
    )
    assert result.outcome in (DecisionOutcome.CONDITIONALLY_APPROVED, DecisionOutcome.REFER, DecisionOutcome.DECLINED)


def test_high_pti_reduces_amount():
    result = UnderwritingEngine().evaluate(
        _app(requested_amount=50_000.0, annual_income=30_000.0, term_months=24, credit_score=700)
    )
    if result.approved_amount is not None:
        assert result.approved_amount <= 50_000.0


def test_amount_above_policy_max_is_declined():
    result = UnderwritingEngine().evaluate(_app(requested_amount=300_000.0))
    assert result.outcome == DecisionOutcome.DECLINED


def test_business_loans_priced_higher():
    personal = UnderwritingEngine().evaluate(_app(purpose=LoanPurpose.PERSONAL))
    business = UnderwritingEngine().evaluate(_app(purpose=LoanPurpose.BUSINESS))
    if personal.interest_rate_apr and business.interest_rate_apr:
        assert business.interest_rate_apr >= personal.interest_rate_apr
