from datetime import date
from typing import Literal
from pydantic import BaseModel, Field


class DeadlineTask(BaseModel):
    subject: str
    task: str
    description: str

    task_type: Literal[
        "assignment",
        "quiz",
        "exam",
        "viva",
        "project",
        "report",
        "lab",
        "other"
    ]

    due_date: date | None

    estimated_hours: float | None = Field(
        ge=0.5,
        le=100
    )

    priority: Literal["low", "medium", "high"]

    confidence: Literal["low", "medium", "high"]

    needs_confirmation: bool

    ambiguity_reason: str | None

    source_text: str


class ExtractionResult(BaseModel):
    tasks: list[DeadlineTask]

class TaskUpdate(BaseModel):

    subject: str | None = None
    task: str | None = None
    description: str | None = None

    due_date: date | None = None

    estimated_hours: float | None = Field(
        default=None,
        ge=0.5,
        le=100
    )

    completed_hours: float = Field(
        default=0.0,
        ge=0,
        le=100
    )

    priority: Literal[
        "low", "medium", "high"
    ] | None = None

    status: Literal[
        "pending", "in_progress", "completed"
    ] | None = None

    needs_confirmation: bool | None = None

    ambiguity_reason: str | None = None