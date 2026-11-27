from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Task(db.Model):

    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)

    subject = db.Column(db.String(100), nullable=False)
    task = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)

    task_type = db.Column(db.String(30), nullable=False)

    due_date = db.Column(db.Date, nullable=True)
    estimated_hours = db.Column(db.Float, nullable=True)

    priority = db.Column(db.String(10), default="medium")
    confidence = db.Column(db.String(10), default="medium")

    needs_confirmation = db.Column(db.Boolean, default=True)
    ambiguity_reason = db.Column(db.Text, nullable=True)

    source_text = db.Column(db.Text, nullable=False)
    source_type = db.Column(db.String(20), default="text")

    status = db.Column(db.String(20), default="pending")

    completed_hours = db.Column(db.Float, default=0.0)

    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc)
    )

    def to_dict(self):

        return {
            "id": self.id,
            "subject": self.subject,
            "task": self.task,
            "description": self.description,
            "task_type": self.task_type,
            "due_date": (
                self.due_date.isoformat()
                if self.due_date else None
            ),
            "estimated_hours": self.estimated_hours,
            "priority": self.priority,
            "confidence": self.confidence,
            "needs_confirmation": self.needs_confirmation,
            "ambiguity_reason": self.ambiguity_reason,
            "source_text": self.source_text,
            "source_type": self.source_type,
            "status": self.status,
            "completed_hours": self.completed_hours,
            "created_at": (
                self.created_at.isoformat()
                if self.created_at else None
            )
        }