import pytest

from engines.duplicate_detector import detect_duplicate


@pytest.fixture
def existing_tasks():
    return [
        {
            "id": 1,
            "subject": "DBMS",
            "task": "DBMS assignment",
            "task_type": "assignment",
            "due_date": "2026-11-30"
        }
    ]


@pytest.mark.parametrize(
    "task, expected",
    [
        pytest.param(
            {
                "subject": "DSA",
                "task": "DSA viva",
                "task_type": "viva",
                "due_date": "2026-11-28"
            },
            "new",
            id="new_task"
        ),
        pytest.param(
            {
                "subject": "DBMS",
                "task": "DBMS Assignment",
                "task_type": "assignment",
                "due_date": "2026-11-30"
            },
            "duplicate",
            id="duplicate_announcement"
        ),
        pytest.param(
            {
                "subject": "DBMS",
                "task": "DBMS assignment",
                "task_type": "assignment",
                "due_date": "2026-12-02"
            },
            "possible_reschedule",
            id="rescheduled_deadline"
        ),
        pytest.param(
            {
                "subject": "DBMS",
                "task": "DBMS assignment",
                "task_type": "assignment",
                "due_date": None
            },
            "possible_match",
            id="uncertain_deadline"
        )
    ]
)
def test_duplicate_classification(task, expected, existing_tasks):

    result = detect_duplicate(task, existing_tasks)

    assert result["classification"] == expected