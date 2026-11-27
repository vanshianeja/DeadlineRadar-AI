import re
from difflib import SequenceMatcher


def normalize_text(text):
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def normalize_task_name(task_name, subject):

    name = normalize_text(task_name)
    subject = normalize_text(subject)

    if subject:
        name = re.sub(
            rf"\b{re.escape(subject)}\b",
            "",
            name
        )

    return normalize_text(name)

def calculate_similarity(text1, text2):

    return SequenceMatcher(
        None,
        normalize_text(text1),
        normalize_text(text2)
    ).ratio()


def detect_duplicate(new_task, existing_tasks):

    best_match = None
    best_score = 0

    for existing in existing_tasks:

        subject_match = (
            normalize_text(new_task["subject"])
            == normalize_text(existing["subject"])
        )

        type_match = (
            new_task["task_type"]
            == existing["task_type"]
        )

        if not subject_match or not type_match:
            continue

        similarity = calculate_similarity(
            normalize_task_name(
                new_task["task"],
                new_task["subject"]
            ),
            normalize_task_name(
                existing["task"],
                existing["subject"]
            )
        )

        if similarity >= 0.75 and similarity > best_score:
            best_match = existing
            best_score = similarity

    if best_match is None:
        return {
            "classification": "new",
            "matched_task_id": None,
            "similarity": 0
        }

    old_date = best_match["due_date"]
    new_date = new_task["due_date"]

    if old_date is None or new_date is None:
        classification = "possible_match"

    elif old_date == new_date:
        classification = "duplicate"

    else:
        classification = "possible_reschedule"

    return {
        "classification": classification,
        "matched_task_id": best_match["id"],
        "similarity": round(best_score, 2),
        "existing_deadline": old_date,
        "new_deadline": new_date
    }