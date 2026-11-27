from copy import deepcopy

import pytest

from engines.extension_negotiator import recommend_extension


def test_minimum_extension(sample_tasks, planning_date):

    result = recommend_extension(
        sample_tasks,
        task_id=1,
        daily_hours=1,
        start_date=planning_date
    )

    assert result["status"] == "recommended"
    assert result["extension_days"] == 1
    assert result["recommended_deadline"] == "2026-12-01"
    assert result["hours_recovered"] == 1


def test_extension_not_required(sample_tasks, planning_date):

    result = recommend_extension(
        sample_tasks,
        task_id=1,
        daily_hours=3,
        start_date=planning_date
    )

    assert result["status"] == "not_needed"
    assert result["extension_days"] == 0


def test_no_feasible_extension(sample_tasks, planning_date):

    result = recommend_extension(
        sample_tasks,
        task_id=1,
        daily_hours=0,
        max_extension_days=7,
        start_date=planning_date
    )

    assert result["status"] == "no_feasible_extension"
    assert len(result["scenarios"]) == 7


def test_invalid_task_id(sample_tasks, planning_date):

    with pytest.raises(ValueError):

        recommend_extension(
            sample_tasks,
            task_id=999,
            daily_hours=1,
            start_date=planning_date
        )


def test_extension_data_integrity(sample_tasks, planning_date):

    original_tasks = deepcopy(sample_tasks)

    result = recommend_extension(
        sample_tasks,
        task_id=1,
        daily_hours=1,
        start_date=planning_date
    )

    assert sample_tasks == original_tasks
    assert result["database_modified"] is False