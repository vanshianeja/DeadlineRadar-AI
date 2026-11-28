from flask import Flask, jsonify, request
from models import db, Task
from engines.extractor import (
    extract_deadlines,
    extract_deadlines_from_image
)
from schemas import ExtractionResult, TaskUpdate
from pydantic import ValidationError
from engines.duplicate_detector import detect_duplicate
from engines.collision_detector import analyze_collisions
from datetime import date
from math import isfinite
from engines.scheduler import generate_schedule
from engines.simulator import simulate_scenario
from engines.extension_negotiator import recommend_extension
from engines.email_generator import generate_extension_email
from flask import Flask, jsonify, request, render_template
import os
from uuid import uuid4
from flask import session
from dotenv import load_dotenv
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

load_dotenv()

app = Flask(__name__)

app.config["SECRET_KEY"] = os.environ["FLASK_SECRET_KEY"]

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = (
    os.getenv("APP_ENV") == "production"
)

# Database configuration
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///deadlineradar.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
# Production request limits
app.config["MAX_CONTENT_LENGTH"] = 6 * 1024 * 1024

limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["300 per hour"],
    storage_uri="memory://"
)

# Connect database with Flask
db.init_app(app)

# Create database tables
with app.app_context():
    db.create_all()

@app.before_request
def initialize_workspace():
    if "workspace_id" not in session:
        session["workspace_id"] = uuid4().hex


def workspace_tasks():
    return Task.query.filter_by(
        workspace_id=session["workspace_id"]
    )

def analyze_extracted_tasks(result):

    existing_tasks = [
        task.to_dict()
        for task in workspace_tasks().all()
    ]

    extracted_tasks = result.model_dump(
        mode="json"
    )["tasks"]

    for task in extracted_tasks:

        task["duplicate_analysis"] = detect_duplicate(
            task,
            existing_tasks
        )

    return extracted_tasks

@app.route("/")
def home():
    return render_template("index.html")


@app.route("/workspace")
def workspace():
    return render_template("workspace.html")

@app.route("/api/health")
def health():
    return jsonify({
        "status": "healthy",
        "database": "connected",
        "total_tasks": workspace_tasks().count()
    })

@app.route("/api/extract/text", methods=["POST"])
@limiter.limit("10 per minute; 40 per hour")
def extract_text():

    data = request.get_json(silent=True) or {}
    message = data.get("message", "")

    if not isinstance(message, str) or not message.strip():
        return jsonify({
            "error": "Please provide a valid message"
        }), 400

    try:
        result = extract_deadlines(message)

        return jsonify({
            "success": True,
            "source_type": "text",
            "count": len(result.tasks),
            "tasks": analyze_extracted_tasks(result)
        })

    except Exception:
        app.logger.exception("Text extraction failed")
        return jsonify({
            "error": "Unable to extract deadlines"
        }), 502

@app.route("/api/extract/image", methods=["POST"])
@limiter.limit("5 per minute; 20 per hour")
def extract_image():

    if "image" not in request.files:
        return jsonify({
            "error": "Please upload an image"
        }), 400

    image = request.files["image"]

    allowed_types = [
        "image/png",
        "image/jpeg",
        "image/webp"
    ]

    if image.mimetype not in allowed_types:
        return jsonify({
            "error": "Unsupported image format"
        }), 400

    image_bytes = image.read(5 * 1024 * 1024 + 1)

    if len(image_bytes) > 5 * 1024 * 1024:
        return jsonify({
            "error": "Image must be smaller than 5 MB"
        }), 413

    if not image_bytes:
        return jsonify({
            "error": "Image cannot be empty"
        }), 400

    try:
        result = extract_deadlines_from_image(
            image_bytes,
            image.mimetype
        )

        return jsonify({
            "success": True,
            "source_type": "image",
            "count": len(result.tasks),
            "tasks": analyze_extracted_tasks(result)
        })

    except Exception:
        app.logger.exception("Image extraction failed")
        return jsonify({
            "error": "Unable to extract deadlines from image"
        }), 502

@app.route("/api/tasks", methods=["GET"])
def get_tasks():

    tasks = workspace_tasks().order_by(
        Task.due_date.asc().nulls_last()
    ).all()

    return jsonify({
        "success": True,
        "count": len(tasks),
        "tasks": [task.to_dict() for task in tasks]
    })

@app.route("/api/tasks", methods=["POST"])
def save_tasks():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Invalid request data"
        }), 400

    source_type = data.get("source_type", "text")

    if source_type not in ["text", "image", "manual"]:
        return jsonify({
            "error": "Invalid source type"
        }), 400

    try:
        validated = ExtractionResult.model_validate(data)

    except ValidationError as e:
        return jsonify({
            "error": "Invalid task data",
            "details": e.errors(include_context=False)
        }), 400

    saved_tasks = []

    try:
        for item in validated.tasks:

            new_task = Task(
                **item.model_dump(),
                workspace_id=session["workspace_id"],
                source_type=source_type,
                status="pending",
                completed_hours=0.0
            )

            db.session.add(new_task)
            saved_tasks.append(new_task)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Tasks saved successfully",
            "count": len(saved_tasks),
            "tasks": [
                task.to_dict()
                for task in saved_tasks
            ]
        }), 201

    except Exception:
        db.session.rollback()
        app.logger.exception("Task saving failed")

        return jsonify({
            "error": "Unable to save tasks"
        }), 500

@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):

    task = workspace_tasks().filter_by(
        id=task_id
    ).first()

    if task is None:
        return jsonify({
            "error": "Task not found"
        }), 404

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Invalid request data"
        }), 400

    try:
        validated = TaskUpdate.model_validate(data)

        updates = validated.model_dump(
            exclude_unset=True
        )

    except ValidationError as e:
        return jsonify({
            "error": "Invalid update data",
            "details": e.errors(include_context=False)
        }), 400

    required_fields = [
        "subject", "task", "description",
        "priority", "status", "needs_confirmation"
    ]

    for field in required_fields:
        if field in updates and updates[field] is None:
            return jsonify({
                "error": f"{field} cannot be null"
            }), 400

    try:
        for field, value in updates.items():
            setattr(task, field, value)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Task updated successfully",
            "task": task.to_dict()
        })

    except Exception:
        db.session.rollback()
        app.logger.exception("Task update failed")

        return jsonify({
            "error": "Unable to update task"
        }), 500

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):

    task = workspace_tasks().filter_by(
        id=task_id
    ).first()

    if task is None:
        return jsonify({
            "error": "Task not found"
        }), 404

    try:
        db.session.delete(task)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Task deleted successfully"
        })

    except Exception:
        db.session.rollback()
        app.logger.exception("Task deletion failed")

        return jsonify({
            "error": "Unable to delete task"
        }), 500

@app.route("/api/collisions", methods=["GET"])
def get_collisions():

    try:
        daily_hours = float(
            request.args.get("daily_hours", 3)
        )

        if not isfinite(daily_hours) or not 0 <= daily_hours <= 24:
            raise ValueError("Invalid daily hours")

        start_date = date.fromisoformat(
            request.args.get(
                "start_date",
                date.today().isoformat()
            )
        )

    except ValueError:
        return jsonify({
            "error": "Invalid study hours or start date"
        }), 400

    tasks = [
        task.to_dict()
        for task in workspace_tasks().all()
    ]

    result = analyze_collisions(
        tasks,
        daily_hours=daily_hours,
        start_date=start_date
    )

    return jsonify({
        "success": True,
        **result
    })

@app.route("/api/schedule", methods=["GET"])
def get_schedule():

    try:
        daily_hours = float(
            request.args.get("daily_hours", 3)
        )

        if not isfinite(daily_hours) or not 0 <= daily_hours <= 24:
            raise ValueError("Invalid daily hours")

        start_date = date.fromisoformat(
            request.args.get(
                "start_date",
                date.today().isoformat()
            )
        )

    except ValueError:
        return jsonify({
            "error": "Invalid study hours or start date"
        }), 400

    tasks = [
        task.to_dict()
        for task in workspace_tasks().all()
    ]

    result = generate_schedule(
        tasks,
        daily_hours=daily_hours,
        start_date=start_date
    )

    return jsonify({
        "success": True,
        **result
    })

@app.route("/api/simulate", methods=["POST"])
def run_simulation():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Invalid request body"
        }), 400

    try:
        baseline_hours = float(
            data.get("baseline_hours", 3)
        )

        simulated_hours = float(
            data.get("simulated_hours", baseline_hours)
        )

        start_date = date.fromisoformat(
            data.get(
                "start_date",
                date.today().isoformat()
            )
        )

        task_changes = data.get("task_changes", [])

        if not isinstance(task_changes, list):
            raise ValueError("Task changes must be a list")

        for change in task_changes:

            if not isinstance(change, dict):
                raise ValueError("Invalid task change")

            if type(change.get("task_id")) is not int:
                raise ValueError("A valid task ID is required")

            allowed_fields = {
                "task_id",
                "due_date",
                "estimated_hours",
                "completed_hours"
            }

            if set(change) - allowed_fields:
                raise ValueError("Unsupported simulation field")

        tasks = [
            task.to_dict()
            for task in workspace_tasks().all()
        ]

        result = simulate_scenario(
            tasks=tasks,
            baseline_hours=baseline_hours,
            simulated_hours=simulated_hours,
            task_changes=task_changes,
            start_date=start_date
        )

        return jsonify({
            "success": True,
            **result
        })

    except (ValueError, TypeError, KeyError, OverflowError) as error:

        return jsonify({
            "success": False,
            "error": str(error)
        }), 400

@app.route("/api/extension", methods=["POST"])
@limiter.limit("10 per minute; 40 per hour")
def get_extension():

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "Invalid request body"
        }), 400

    try:
        task_id = data.get("task_id")

        if type(task_id) is not int:
            raise ValueError("A valid task ID is required")

        daily_hours = float(
            data.get("daily_hours", 3)
        )

        max_extension_days = data.get(
            "max_extension_days", 7
        )

        start_date = date.fromisoformat(
            data.get(
                "start_date",
                date.today().isoformat()
            )
        )

        generate_email = data.get("generate_email", False)

        if type(generate_email) is not bool:
            raise ValueError("Invalid generate_email value")

        tasks = [
            task.to_dict()
            for task in workspace_tasks().all()
        ]

        recommendation = recommend_extension(
            tasks=tasks,
            task_id=task_id,
            daily_hours=daily_hours,
            max_extension_days=max_extension_days,
            start_date=start_date
        )

    except (ValueError, TypeError, OverflowError) as error:

        return jsonify({
            "success": False,
            "error": str(error)
        }), 400

    email_draft = None
    email_error = None

    # Generate email only when requested
    # and a feasible extension exists
    if (
        generate_email
        and recommendation["status"] == "recommended"
    ):

        try:
            email_draft = generate_extension_email(
                recommendation
            )

        except Exception:
            app.logger.exception("Email generation failed")

            email_error = (
                "Email generation is temporarily unavailable. "
                "The extension recommendation is still valid."
            )

    return jsonify({
        "success": True,
        "recommendation": recommendation,
        "email_draft": email_draft,
        "email_error": email_error,
        "email_sent": False
    })

@app.errorhandler(429)
def rate_limit_exceeded(error):
    return jsonify({
        "success": False,
        "error": "Too many requests. Please try again later."
    }), 429


@app.errorhandler(413)
def request_too_large(error):
    return jsonify({
        "success": False,
        "error": "The uploaded file or request is too large."
    }), 413

if __name__ == "__main__":
    app.run(debug=False)