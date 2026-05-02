from __future__ import annotations

import uuid
from typing import Any

from .models import DemoSession, STEP_ORDER, utc_now


SESSIONS: dict[str, DemoSession] = {}


def new_session_id() -> str:
    return uuid.uuid4().hex[:12]


def put_session(session: DemoSession) -> DemoSession:
    session.updated_at = utc_now()
    SESSIONS[session.session_id] = session
    return session


def get_session(session_id: str) -> DemoSession:
    try:
        return SESSIONS[session_id]
    except KeyError as exc:
        raise KeyError(f"Unknown session: {session_id}") from exc


def log_event(
    session: DemoSession,
    step: str,
    level: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> None:
    session.logs.append(
        {
            "timestamp": utc_now(),
            "step": step,
            "level": level,
            "message": message,
            "details": details or {},
        }
    )
    session.updated_at = utc_now()


def init_steps(session: DemoSession) -> None:
    for step in STEP_ORDER:
        session.steps.setdefault(
            step,
            {
                "name": step,
                "status": "pending",
                "runtime_sec": None,
                "input_count": None,
                "output_count": None,
                "explanation": None,
                "error": None,
                "updated_at": utc_now(),
            },
        )


def update_step(
    session: DemoSession,
    step: str,
    *,
    status: str,
    runtime_sec: float | None = None,
    input_count: int | None = None,
    output_count: int | None = None,
    explanation: str | None = None,
    error: str | None = None,
) -> None:
    init_steps(session)
    session.steps[step].update(
        {
            "status": status,
            "runtime_sec": runtime_sec,
            "input_count": input_count,
            "output_count": output_count,
            "explanation": explanation,
            "error": error,
            "updated_at": utc_now(),
        }
    )
    session.updated_at = utc_now()
