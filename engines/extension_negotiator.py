from datetime import date, timedelta
from math import isfinite

from engines.simulator import simulate_scenario
from engines.scheduler import generate_schedule


def recommend_extension(
    tasks,
    task_id,
    daily_hours=3.0,
    max_extension_days=7,
    start_date=None
):

    if start_date is None:
        start_date = date.today()

    if not isfinite(daily_hours) or not 0 <= daily_hours <= 24:
        raise ValueError("Invalid daily study hours")

    if type(max_extension_days) is not int or not 1 <= max_extension_days <= 30:
        raise ValueError("Extension limit must be between 1 and 30 days")

    # Step 1: Find the selected task
    selected_task = next(
        (task for task in tasks if task["id"] == task_id),
        None
    )

    if selected_task is None:
        raise ValueError("Task not found")

    if selected_task["status"] == "completed":
        raise ValueError("Task is already completed")

    if (
        selected_task.get("needs_confirmation")
        or not selected_task.get("due_date")
        or selected_task.get("estimated_hours") is None
    ):
        raise ValueError(
            "Confirm the task deadline and estimated effort first"
        )

    original_deadline = date.fromisoformat(
        selected_task["due_date"]
    )

    if original_deadline < start_date:
        raise ValueError("The selected task is already overdue")

    # Step 2: Analyze current workload
    baseline = generate_schedule(
        tasks,
        daily_hours=daily_hours,
        start_date=start_date
    )

    baseline_deficit = baseline["total_unscheduled_hours"]

    result = {
        "task_id": task_id,
        "task": selected_task["task"],
        "subject": selected_task.get("subject", ""),
        "original_deadline": original_deadline.isoformat(),
        "daily_hours": daily_hours,
        "baseline_deficit_hours": baseline_deficit,
        "baseline_tasks_at_risk": baseline["tasks_at_risk"],
        "excluded_task_ids": baseline["excluded_task_ids"],
        "overdue_task_ids": baseline["overdue_task_ids"],
        "recommended_deadline": None,
        "extension_days": None,
        "hours_recovered": 0,
        "scenarios": [],
        "database_modified": False
    }

    # Step 3: Check whether an extension is necessary
    if baseline["feasible"]:

        result.update({
            "status": "not_needed",
            "extension_days": 0,
            "recommended_deadline": original_deadline.isoformat(),
            "message": "Current eligible workload is manageable."
        })

        return result

    # Step 4: Test extensions incrementally
    for days in range(1, max_extension_days + 1):

        new_deadline = original_deadline + timedelta(days=days)

        simulation = simulate_scenario(
            tasks=tasks,
            baseline_hours=daily_hours,
            simulated_hours=daily_hours,
            task_changes=[
                {
                    "task_id": task_id,
                    "due_date": new_deadline.isoformat()
                }
            ],
            start_date=start_date
        )

        comparison = simulation["comparison"]

        result["scenarios"].append({
            "extension_days": days,
            "new_deadline": new_deadline.isoformat(),
            "remaining_deficit_hours":
                comparison["simulated_deficit_hours"],
            "tasks_at_risk":
                comparison["simulated_tasks_at_risk"],
            "feasible":
                comparison["simulated_feasible"]
        })

        # Step 5: Return the smallest successful extension
        if comparison["simulated_feasible"]:

            result.update({
                "status": "recommended",
                "recommended_deadline": new_deadline.isoformat(),
                "extension_days": days,
                "hours_recovered": comparison["hours_recovered"],
                "remaining_deficit_hours": 0,
                "message": (
                    f"A {days}-day extension resolves "
                    "the predicted workload deficit."
                )
            })

            return result

    # Step 6: Handle cases where extension is insufficient
    result.update({
        "status": "no_feasible_extension",
        "message": (
            "Extending this task alone within the selected "
            "limit cannot resolve the entire workload deficit."
        )
    })

    return result