from datetime import date

import pytest


@pytest.fixture
def sample_tasks():
    return [
        {
            "id": 1,
            "subject": "DBMS",
            "task": "DBMS Assignment",
            "due_date": "2026-11-30",
            "estimated_hours": 4,
            "completed_hours": 0,
            "priority": "high",
            "status": "pending",
            "needs_confirmation": False
        },
        {
            "id": 2,
            "subject": "DSA",
            "task": "DSA Viva",
            "due_date": "2026-11-28",
            "estimated_hours": 2,
            "completed_hours": 1,
            "priority": "high",
            "status": "in_progress",
            "needs_confirmation": False
        }
    ]


@pytest.fixture
def planning_date():
    return date(2026, 11, 27)