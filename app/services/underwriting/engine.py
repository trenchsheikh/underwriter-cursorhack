"""Rule-based underwriting engine.

Produces a risk score in [0, 100] (lower is better), an outcome, an approved
amount + APR, and a list of human-readable reasons. The implementation is
intentionally transparent and deterministic so that decisions are explainable
and auditable.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.models.application import Application, LoanPurpose
from app.models.decision import DecisionOutcome


@dataclass
class EvaluationResult:
    outcome: DecisionOutcome
    risk_score: float
    approved_amount: float | None
    interest_rate_apr: float | None
    reasons: list[str] = field(default_factory=list)
    narrative: str | None = None


def _safe_dti(monthly_debt: float, annual_income: float) -> float:
    monthly_income = max(annual_income, 0.0) / 12.0
    if monthly_income <= 0:
        return 1.0
    return min(monthly_debt / monthly_income, 5.0)


def _payment_to_income(requested_amount: float, term_months: int, apr: float, annual_income: float) -> float:
    """Approximate monthly-payment-to-income ratio using simple amortization."""
    monthly_income = max(annual_income, 0.0) / 12.0
    if monthly_income <= 0 or term_months <= 0:
        return 1.0
    r = max(apr, 0.0) / 12.0 / 100.0
    if r == 0:
        payment = requested_amount / term_months
    else:
        payment = requested_amount * (r * (1 + r) ** term_months) / ((1 + r) ** term_months - 1)
    return min(payment / monthly_income, 5.0)


def _purpose_risk_weight(purpose: LoanPurpose) -> float:
    return {
        LoanPurpose.HOME: 0.9,
        LoanPurpose.AUTO: 1.0,
        LoanPurpose.EDUCATION: 1.0,
        LoanPurpose.PERSONAL: 1.1,
        LoanPurpose.BUSINESS: 1.2,
        LoanPurpose.OTHER: 1.15,
    }.get(purpose, 1.1)


class UnderwritingEngine:
    """Deterministic rule-based engine. Easy to unit-test and extend."""

    MIN_CREDIT = 580
    AUTO_APPROVE_CREDIT = 720
    MAX_DTI = 0.45
    MAX_PTI = 0.35
    MAX_LOAN = 250_000.0

    def evaluate(self, application: Application) -> EvaluationResult:
        reasons: list[str] = []
        score = 50.0

        credit = application.credit_score
        if credit is None:
            reasons.append("No credit score provided; manual review required.")
            score += 15
        elif credit < self.MIN_CREDIT:
            reasons.append(f"Credit score {credit} below minimum {self.MIN_CREDIT}.")
            score += 35
        elif credit >= self.AUTO_APPROVE_CREDIT:
            reasons.append(f"Strong credit score ({credit}).")
            score -= 20
        else:
            reasons.append(f"Acceptable credit score ({credit}).")
            score -= (credit - self.MIN_CREDIT) / (self.AUTO_APPROVE_CREDIT - self.MIN_CREDIT) * 15

        dti = _safe_dti(application.monthly_debt_payments, application.annual_income)
        if application.annual_income <= 0:
            reasons.append("No income reported.")
            score += 25
        if dti > self.MAX_DTI:
            reasons.append(f"Debt-to-income {dti:.0%} exceeds {self.MAX_DTI:.0%} threshold.")
            score += 20
        else:
            reasons.append(f"Debt-to-income within policy ({dti:.0%}).")
            score -= (self.MAX_DTI - dti) * 10

        years = application.years_at_employer or 0.0
        if years >= 2:
            reasons.append(f"Stable employment ({years:.1f} years).")
            score -= 5
        elif years > 0:
            reasons.append(f"Short tenure at current employer ({years:.1f} years).")
            score += 5
        else:
            reasons.append("Employment tenure unknown or unemployed.")
            score += 8

        if application.requested_amount > self.MAX_LOAN:
            reasons.append(
                f"Requested amount ${application.requested_amount:,.0f} exceeds policy max ${self.MAX_LOAN:,.0f}."
            )
            score += 25

        score *= _purpose_risk_weight(application.purpose)
        score = max(0.0, min(100.0, score))

        base_apr = self._price(score, application.purpose)
        pti = _payment_to_income(
            application.requested_amount, application.term_months, base_apr, application.annual_income
        )
        if pti > self.MAX_PTI:
            reasons.append(
                f"Payment-to-income {pti:.0%} exceeds {self.MAX_PTI:.0%}; reducing approved amount."
            )

        outcome, approved_amount, apr = self._decide(application, score, base_apr, pti)

        narrative = self._narrative(application, outcome, score, approved_amount, apr, reasons)

        return EvaluationResult(
            outcome=outcome,
            risk_score=round(score, 2),
            approved_amount=round(approved_amount, 2) if approved_amount is not None else None,
            interest_rate_apr=round(apr, 2) if apr is not None else None,
            reasons=reasons,
            narrative=narrative,
        )

    def _price(self, score: float, purpose: LoanPurpose) -> float:
        base = 6.0 + (score / 100.0) * 24.0
        purpose_adj = {
            LoanPurpose.HOME: -1.5,
            LoanPurpose.AUTO: -0.5,
            LoanPurpose.EDUCATION: -0.25,
            LoanPurpose.PERSONAL: 0.0,
            LoanPurpose.BUSINESS: 1.5,
            LoanPurpose.OTHER: 0.5,
        }.get(purpose, 0.0)
        return max(3.0, min(35.99, base + purpose_adj))

    def _decide(
        self,
        application: Application,
        score: float,
        base_apr: float,
        pti: float,
    ) -> tuple[DecisionOutcome, float | None, float | None]:
        if application.credit_score is not None and application.credit_score < self.MIN_CREDIT:
            return DecisionOutcome.DECLINED, None, None
        if application.requested_amount > self.MAX_LOAN:
            return DecisionOutcome.DECLINED, None, None
        if application.annual_income <= 0:
            return DecisionOutcome.DECLINED, None, None

        approved = application.requested_amount
        if pti > self.MAX_PTI:
            approved = self._max_amount_for_pti(
                application.annual_income, application.term_months, base_apr, self.MAX_PTI
            )
            approved = max(0.0, min(approved, application.requested_amount))

        if approved < 500.0:
            return DecisionOutcome.DECLINED, None, None

        if score <= 30 and approved >= application.requested_amount * 0.999:
            return DecisionOutcome.APPROVED, approved, base_apr
        if score <= 55:
            return DecisionOutcome.CONDITIONALLY_APPROVED, approved, base_apr
        if score <= 75:
            return DecisionOutcome.REFER, approved, base_apr
        return DecisionOutcome.DECLINED, None, None

    @staticmethod
    def _max_amount_for_pti(
        annual_income: float, term_months: int, apr: float, max_pti: float
    ) -> float:
        max_payment = (annual_income / 12.0) * max_pti
        r = max(apr, 0.0) / 12.0 / 100.0
        if r == 0:
            return max_payment * term_months
        return max_payment * ((1 + r) ** term_months - 1) / (r * (1 + r) ** term_months)

    @staticmethod
    def _narrative(
        application: Application,
        outcome: DecisionOutcome,
        score: float,
        approved_amount: float | None,
        apr: float | None,
        reasons: list[str],
    ) -> str:
        amount_str = f"${approved_amount:,.2f}" if approved_amount else "n/a"
        apr_str = f"{apr:.2f}% APR" if apr else "n/a"
        bullets = "\n".join(f"  - {r}" for r in reasons)
        return (
            f"Outcome: {outcome.value.upper()}\n"
            f"Risk score: {score:.1f}/100 (lower is better)\n"
            f"Approved amount: {amount_str} | Pricing: {apr_str}\n"
            f"Requested: ${application.requested_amount:,.2f} for {application.term_months} months "
            f"({application.purpose.value}).\n"
            f"Key factors:\n{bullets}"
        )


def evaluate_application(application: Application) -> EvaluationResult:
    return UnderwritingEngine().evaluate(application)
