from flask import Flask

app = Flask(__name__)


@app.route("/")
def home():
    return {
        "application": "DeadlineRadar AI",
        "tagline": "Predict. Simulate. Optimize. Recover.",
        "status": "Running successfully"
    }


if __name__ == "__main__":
    app.run(debug=True)