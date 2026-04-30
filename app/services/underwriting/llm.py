"""Optional LLM-assisted narrative.

If `CURSOR_API_KEY` is set, requests a short, plain-English explanation of
the decision from an OpenAI-compatible chat-completions endpoint
(`CURSOR_API_BASE_URL`, defaults to `https://api.openai.com/v1`). Falls
back to the deterministic narrative produced by the rule-based engine when
unset or on any error. The rule-based decision is always authoritative;
the LLM never changes the outcome.
"""

from __future__ import annotations

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.application import Application
from app.services.underwriting.engine import EvaluationResult

log = get_logger(__name__)


_PROMPT = (
    "You are a careful loan underwriting assistant. Given a deterministic decision "
    "summary produced by a rule-based engine, write a short (3-5 sentence) "
    "explanation suitable for an internal review note. Do NOT change the outcome, "
    "amount, or APR. Be neutral and avoid speculation."
)


def enrich_narrative(application: Application, result: EvaluationResult) -> str | None:
    settings = get_settings()
    if not settings.cursor_api_key:
        return result.narrative

    payload = {
        "model": settings.cursor_model,
        "messages": [
            {"role": "system", "content": _PROMPT},
            {
                "role": "user",
                "content": (
                    f"Decision: {result.outcome.value}\n"
                    f"Risk score: {result.risk_score}\n"
                    f"Approved: {result.approved_amount}\n"
                    f"APR: {result.interest_rate_apr}\n"
                    f"Reasons: {result.reasons}\n"
                    f"Requested: {application.requested_amount} for {application.term_months} months "
                    f"({application.purpose.value})\n"
                ),
            },
        ],
        "temperature": 0.2,
        "max_tokens": 220,
    }
    base_url = settings.cursor_api_base_url.rstrip("/")
    url = f"{base_url}/chat/completions"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                url,
                headers={
                    "Authorization": f"Bearer {settings.cursor_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            if not text:
                return result.narrative
            return f"{result.narrative}\n\nAssistant note:\n{text}"
    except Exception as exc:
        log.warning("llm_narrative_failed", error=str(exc))
        return result.narrative
