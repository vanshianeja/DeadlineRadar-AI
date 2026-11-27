from copy import deepcopy

from engines.scheduler import generate_schedule


def test_manageable_workload(sample_tasks, planning_date):

    result = generate_schedule(
        sample_tasks,
        daily_hours=3,
        start_date=planning_date
    )

    assert result["feasible"] is True
    assert result["total_required_hours"] == 5
    assert result["total_scheduled_hours"] == 5
    assert result["total_unscheduled_hours"] == 0

    assert result["schedule"][0]["sessions"][0]["task_id"] == 2


def test_overloaded_workload(sample_tasks, planning_date):

    result = generate_schedule(
        sample_tasks,
        daily_hours=1,
        start_date=planning_date
    )

    assert result["feasible"] is False
    assert result["total_scheduled_hours"] == 4
    assert result["total_unscheduled_hours"] == 1
    assert result["tasks_at_risk"][0]["task_id"] == 1


def test_daily_capacity_constraint(sample_tasks, planning_date):

    result = generate_schedule(
        sample_tasks,
        daily_hours=2,
        start_date=planning_date
    )

    for day in result["schedule"]:
        assert day["allocated_hours"] <= 2

    assert result["feasible"] is True


def test_zero_availability(sample_tasks, planning_date):

    result = generate_schedule(
        sample_tasks,
        daily_hours=0,
        start_date=planning_date
    )

    assert result["feasible"] is False
    assert result["total_scheduled_hours"] == 0
    assert result["total_unscheduled_hours"] == 5


def test_scheduler_data_integrity(sample_tasks, planning_date):

    original_tasks = deepcopy(sample_tasks)

    generate_schedule(
        sample_tasks,
        daily_hours=3,
        start_date=planning_date
    )

    assert sample_tasks == original_tasks