from copy import deepcopy

from engines.simulator import simulate_scenario


def test_reduced_availability(sample_tasks, planning_date):

    result = simulate_scenario(
        sample_tasks,
        baseline_hours=3,
        simulated_hours=1,
        start_date=planning_date
    )

    assert result["comparison"]["outcome"] == "worsened"
    assert result["comparison"]["simulated_deficit_hours"] == 1


def test_increased_availability(sample_tasks, planning_date):

    result = simulate_scenario(
        sample_tasks,
        baseline_hours=1,
        simulated_hours=2,
        start_date=planning_date
    )

    assert result["comparison"]["outcome"] == "improved"
    assert result["comparison"]["hours_recovered"] == 1
    assert result["comparison"]["simulated_feasible"] is True


def test_hypothetical_deadline_extension(sample_tasks, planning_date):

    result = simulate_scenario(
        sample_tasks,
        baseline_hours=1,
        task_changes=[
            {
                "task_id": 1,
                "due_date": "2026-12-01"
            }
        ],
        start_date=planning_date
    )

    assert result["comparison"]["baseline_feasible"] is False
    assert result["comparison"]["simulated_feasible"] is True
    assert result["comparison"]["hours_recovered"] == 1


def test_hypothetical_progress(sample_tasks, planning_date):

    result = simulate_scenario(
        sample_tasks,
        baseline_hours=1,
        task_changes=[
            {
                "task_id": 1,
                "completed_hours": 2
            }
        ],
        start_date=planning_date
    )

    assert result["comparison"]["outcome"] == "improved"
    assert result["comparison"]["simulated_feasible"] is True


def test_simulator_data_integrity(sample_tasks, planning_date):

    original_tasks = deepcopy(sample_tasks)

    result = simulate_scenario(
        sample_tasks,
        baseline_hours=1,
        simulated_hours=2,
        task_changes=[
            {
                "task_id": 1,
                "due_date": "2026-12-01",
                "completed_hours": 2
            }
        ],
        start_date=planning_date
    )

    assert sample_tasks == original_tasks
    assert result["database_modified"] is False