from datetime import date


def analyze_collisions(
    tasks,
    daily_hours=3.0,
    start_date=None
):

    if start_date is None:
        start_date = date.today()

    if daily_hours < 0 or daily_hours > 24:
        raise ValueError("Invalid daily study hours")

    active_tasks = []
    excluded_tasks = []
    overdue_tasks = []

    for task in tasks:

        if task["status"] == "completed":
            continue

        if (
            task.get("needs_confirmation")
            or not task.get("due_date")
            or task.get("estimated_hours") is None
        ):
            excluded_tasks.append(task)
            continue

        deadline = date.fromisoformat(
            task["due_date"]
        )

        remaining_hours = max(
            0,
            task["estimated_hours"]
            - (task.get("completed_hours") or 0)
        )

        if remaining_hours == 0:
            continue

        task_data = {
            **task,
            "deadline": deadline,
            "remaining_hours": remaining_hours
        }

        if deadline < start_date:
            overdue_tasks.append(task_data)
            continue

        active_tasks.append(task_data)

    active_tasks.sort(
        key=lambda task: task["deadline"]
    )

    deadlines = sorted({
        task["deadline"]
        for task in active_tasks
    })

    checkpoints = []

    for deadline in deadlines:

        relevant_tasks = [
            task for task in active_tasks
            if task["deadline"] <= deadline
        ]

        required_hours = sum(
            task["remaining_hours"]
            for task in relevant_tasks
        )

        available_days = (
            deadline - start_date
        ).days + 1

        available_hours = (
            available_days * daily_hours
        )

        deficit = max(
            0,
            required_hours - available_hours
        )

        utilization = (
            required_hours / available_hours * 100
            if available_hours > 0
            else None
        )

        if deficit > 0:
            risk = "critical"

        elif utilization is not None and utilization >= 80:
            risk = "high"

        elif utilization is not None and utilization >= 60:
            risk = "moderate"

        else:
            risk = "low"

        checkpoints.append({
            "deadline": deadline.isoformat(),
            "required_hours": round(required_hours, 2),
            "available_hours": round(available_hours, 2),
            "deficit_hours": round(deficit, 2),
            "utilization": (
                round(utilization, 2)
                if utilization is not None
                else None
            ),
            "risk": risk,
            "task_ids": [
                task["id"]
                for task in relevant_tasks
            ]
        })

    collisions = [
        checkpoint
        for checkpoint in checkpoints
        if checkpoint["deficit_hours"] > 0
    ]

    return {
        "start_date": start_date.isoformat(),
        "daily_hours": daily_hours,
        "total_active_tasks": len(active_tasks),
        "excluded_task_ids": [
            task["id"] for task in excluded_tasks
        ],
        "overdue_task_ids": [
            task["id"] for task in overdue_tasks
        ],
        "total_remaining_hours": round(
            sum(
                task["remaining_hours"]
                for task in active_tasks
            ), 2
        ),
        "collision_detected": len(collisions) > 0,
        "collision_count": len(collisions),
        "checkpoints": checkpoints,
        "collisions": collisions
    }