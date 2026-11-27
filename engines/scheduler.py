from datetime import date, timedelta
from math import isfinite


def generate_schedule(
    tasks,
    daily_hours=3.0,
    start_date=None
):

    if start_date is None:
        start_date = date.today()

    if not isfinite(daily_hours) or not 0 <= daily_hours <= 24:
        raise ValueError("Invalid daily study hours")

    priority_order = {
        "high": 0,
        "medium": 1,
        "low": 2
    }

    active_tasks = []
    excluded_tasks = []
    overdue_tasks = []

    # Step 1: Prepare tasks
    for task in tasks:

        if task["status"] == "completed":
            continue

        if (
            task.get("needs_confirmation")
            or not task.get("due_date")
            or task.get("estimated_hours") is None
        ):
            excluded_tasks.append(task["id"])
            continue

        deadline = date.fromisoformat(
            task["due_date"]
        )

        remaining = max(
            0,
            task["estimated_hours"]
            - (task.get("completed_hours") or 0)
        )

        if remaining == 0:
            continue

        if deadline < start_date:
            overdue_tasks.append(task["id"])
            continue

        active_tasks.append({
            **task,
            "deadline": deadline,
            "remaining": remaining
        })

    # Step 2: Sort by deadline and priority
    active_tasks.sort(
        key=lambda task: (
            task["deadline"],
            priority_order.get(
                task.get("priority"), 1
            ),
            task["id"]
        )
    )

    total_required = sum(
        task["remaining"]
        for task in active_tasks
    )

    schedule = {}
    unscheduled_tasks = []

    # Step 3: Allocate study hours
    for task in active_tasks:

        current_date = start_date

        while (
            task["remaining"] > 0.000001
            and current_date <= task["deadline"]
            and daily_hours > 0
        ):

            day = current_date.isoformat()

            if day not in schedule:
                schedule[day] = {
                    "date": day,
                    "allocated_hours": 0.0,
                    "sessions": []
                }

            available = max(
                0,
                daily_hours
                - schedule[day]["allocated_hours"]
            )

            if available > 0.000001:

                allocated = min(
                    available,
                    task["remaining"]
                )

                schedule[day]["sessions"].append({
                    "task_id": task["id"],
                    "task": task["task"],
                    "subject": task.get("subject", ""),
                    "hours": allocated,
                    "priority": task.get(
                        "priority", "medium"
                    )
                })

                schedule[day]["allocated_hours"] += allocated
                task["remaining"] -= allocated

            current_date += timedelta(days=1)

        # Step 4: Identify unfinished tasks
        if task["remaining"] > 0.000001:

            unscheduled_tasks.append({
                "task_id": task["id"],
                "task": task["task"],
                "deadline": task["due_date"],
                "unscheduled_hours": round(
                    task["remaining"], 2
                )
            })

    # Step 5: Prepare final schedule
    final_schedule = []

    for day in sorted(schedule):

        entry = schedule[day]

        if not entry["sessions"]:
            continue

        entry["remaining_capacity"] = round(
            max(
                0,
                daily_hours - entry["allocated_hours"]
            ), 2
        )

        entry["allocated_hours"] = round(
            entry["allocated_hours"], 2
        )

        for session in entry["sessions"]:
            session["hours"] = round(
                session["hours"], 2
            )

        final_schedule.append(entry)

    total_unscheduled = sum(
        task["unscheduled_hours"]
        for task in unscheduled_tasks
    )

    return {
        "start_date": start_date.isoformat(),
        "daily_hours": daily_hours,
        "total_required_hours": round(
            total_required, 2
        ),
        "total_scheduled_hours": round(
            total_required - total_unscheduled, 2
        ),
        "total_unscheduled_hours": round(
            total_unscheduled, 2
        ),
        "feasible": len(unscheduled_tasks) == 0,
        "schedule": final_schedule,
        "tasks_at_risk": unscheduled_tasks,
        "excluded_task_ids": excluded_tasks,
        "overdue_task_ids": overdue_tasks
    }