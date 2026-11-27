from copy import deepcopy
from datetime import date
from math import isfinite

from engines.collision_detector import analyze_collisions
from engines.scheduler import generate_schedule


def simulate_scenario(
    tasks,
    baseline_hours=3.0,
    simulated_hours=None,
    task_changes=None,
    start_date=None
):

    if start_date is None:
        start_date = date.today()

    if simulated_hours is None:
        simulated_hours = baseline_hours

    for hours in [baseline_hours, simulated_hours]:
        if not isfinite(hours) or not 0 <= hours <= 24:
            raise ValueError("Invalid daily study hours")

    if task_changes is None:
        task_changes = []

    # Step 1: Create an independent copy
    simulated_tasks = deepcopy(tasks)

    # Step 2: Apply hypothetical changes
    for change in task_changes:

        task_id = change["task_id"]

        task = next(
            (
                t for t in simulated_tasks
                if t["id"] == task_id
            ),
            None
        )

        if task is None:
            raise ValueError(
                f"Task {task_id} not found"
            )

        if "due_date" in change:

            new_date = date.fromisoformat(
                change["due_date"]
            )

            if new_date < start_date:
                raise ValueError(
                    "Simulated deadline cannot be in the past"
                )

            task["due_date"] = new_date.isoformat()

        if "estimated_hours" in change:

            hours = float(change["estimated_hours"])

            if not isfinite(hours) or not 0.5 <= hours <= 100:
                raise ValueError("Invalid estimated hours")

            task["estimated_hours"] = hours

        if "completed_hours" in change:

            hours = float(change["completed_hours"])

            if not isfinite(hours) or not 0 <= hours <= 100:
                raise ValueError("Invalid completed hours")

            task["completed_hours"] = hours

        if (
            task.get("estimated_hours") is not None
            and task.get("completed_hours", 0)
            > task["estimated_hours"]
        ):
            raise ValueError(
                "Completed hours cannot exceed estimated hours"
            )

    # Step 3: Analyze the original situation
    baseline_collision = analyze_collisions(
        tasks,
        daily_hours=baseline_hours,
        start_date=start_date
    )

    baseline_schedule = generate_schedule(
        tasks,
        daily_hours=baseline_hours,
        start_date=start_date
    )

    # Step 4: Analyze the hypothetical situation
    simulated_collision = analyze_collisions(
        simulated_tasks,
        daily_hours=simulated_hours,
        start_date=start_date
    )

    simulated_schedule = generate_schedule(
        simulated_tasks,
        daily_hours=simulated_hours,
        start_date=start_date
    )

    # Step 5: Compare results
    baseline_deficit = (
        baseline_schedule["total_unscheduled_hours"]
    )

    simulated_deficit = (
        simulated_schedule["total_unscheduled_hours"]
    )

    improvement = round(
        baseline_deficit - simulated_deficit, 2
    )

    if improvement > 0:
        outcome = "improved"

    elif improvement < 0:
        outcome = "worsened"

    else:
        outcome = "unchanged"

    return {
        "baseline": {
            "collision_analysis": baseline_collision,
            "schedule_analysis": baseline_schedule
        },

        "simulation": {
            "collision_analysis": simulated_collision,
            "schedule_analysis": simulated_schedule
        },

        "comparison": {
            "baseline_daily_hours": baseline_hours,
            "simulated_daily_hours": simulated_hours,

            "baseline_deficit_hours": baseline_deficit,
            "simulated_deficit_hours": simulated_deficit,

            "hours_recovered": improvement,

            "baseline_collisions":
                baseline_collision["collision_count"],

            "simulated_collisions":
                simulated_collision["collision_count"],

            "baseline_tasks_at_risk":
                len(baseline_schedule["tasks_at_risk"]),

            "simulated_tasks_at_risk":
                len(simulated_schedule["tasks_at_risk"]),

            "baseline_feasible":
                baseline_schedule["feasible"],

            "simulated_feasible":
                simulated_schedule["feasible"],

            "outcome": outcome
        },

        "applied_changes": task_changes,
        "database_modified": False
    }