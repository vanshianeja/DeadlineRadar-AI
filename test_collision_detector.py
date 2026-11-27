from datetime import date
from copy import deepcopy

import pytest

from engines.collision_detector import analyze_collisions


@pytest.fixture
def tasks():
    return [
        {
            "id": 1,
            "task": "DBMS Assignment",
            "due_date": "2026-11-30",
            "estimated_hours": 4,
            "completed_hours": 0,
            "status": "pending",
            "needs_confirmation": False
        },
        {
            "id": 2,
            "task": "DSA Viva",
            "due_date": "2026-11-28",
            "estimated_hours": 2,
            "completed_hours": 1,
            "status": "in_progress",
            "needs_confirmation": False
        },
        {
            "id": 3,
            "task": "SML Project",
            "due_date": "2026-11-30",
            "estimated_hours": 8,
            "completed_hours": 0,
            "status": "pending",
            "needs_confirmation": False
        },
        {
            "id": 4,
            "task": "MPCA Report",
            "due_date": "2026-11-30",
            "estimated_hours": 5,
            "completed_hours": 0,
            "status": "pending",
            "needs_confirmation": False
        }
    ]


START_DATE = date(2026, 11, 27)


def test_overloaded_student(tasks):

    result = analyze_collisions(
        tasks,
        daily_hours=3,
        start_date=START_DATE
    )

    assert result["collision_detected"] is True
    assert result["total_remaining_hours"] == 18
    assert result["collisions"][-1]["deficit_hours"] == 6


def test_sufficient_study_hours(tasks):

    result = analyze_collisions(
        tasks,
        daily_hours=5,
        start_date=START_DATE
    )

    assert result["collision_detected"] is False


def test_progress_tracking(tasks):

    tasks[2]["completed_hours"] = 6

    result = analyze_collisions(
        tasks,
        daily_hours=3,
        start_date=START_DATE
    )

    assert result["total_remaining_hours"] == 12
    assert result["collision_detected"] is False


def test_zero_availability(tasks):

    tasks[2]["completed_hours"] = 6

    result = analyze_collisions(
        tasks,
        daily_hours=0,
        start_date=START_DATE
    )

    assert result["collision_detected"] is True
    assert result["collisions"][-1]["deficit_hours"] == 12


def test_original_tasks_not_modified(tasks):

    original_tasks = deepcopy(tasks)

    analyze_collisions(
        tasks,
        daily_hours=3,
        start_date=START_DATE
    )

    assert tasks == original_tasks