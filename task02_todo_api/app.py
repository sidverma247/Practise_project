"""Todo List REST API — Flask, in-memory storage, full CRUD + validation."""
from __future__ import annotations
from datetime import datetime, timezone
from flask import Flask, jsonify, request


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def create_app() -> Flask:
    app = Flask(__name__)
    todos: dict[str, dict] = {}
    counter = {"id": 0}

    def next_id() -> str:
        counter["id"] += 1
        return str(counter["id"])

    def validate_create(data):
        if not isinstance(data, dict):
            return "Request body must be a JSON object"
        title = data.get("title")
        if not isinstance(title, str) or not title.strip():
            return "title is required and must be a non-empty string"
        if "completed" in data and not isinstance(data["completed"], bool):
            return "completed must be a boolean"
        return None

    @app.get("/todos")
    def list_todos():
        return jsonify(list(todos.values())), 200

    @app.get("/todos/<tid>")
    def get_todo(tid):
        todo = todos.get(tid)
        if not todo:
            return jsonify({"error": "Todo not found"}), 404
        return jsonify(todo), 200

    @app.post("/todos")
    def create_todo():
        data = request.get_json(silent=True)
        err = validate_create(data)
        if err:
            return jsonify({"error": err}), 400
        tid = next_id()
        todo = {
            "id": tid,
            "title": data["title"].strip(),
            "description": (data.get("description") or "").strip(),
            "completed": bool(data.get("completed", False)),
            "createdAt": utcnow_iso(),
        }
        todos[tid] = todo
        return jsonify(todo), 201

    @app.put("/todos/<tid>")
    def update_todo(tid):
        todo = todos.get(tid)
        if not todo:
            return jsonify({"error": "Todo not found"}), 404
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Request body must be a JSON object"}), 400
        if "title" in data:
            if not isinstance(data["title"], str) or not data["title"].strip():
                return jsonify({"error": "title must be a non-empty string"}), 400
            todo["title"] = data["title"].strip()
        if "description" in data:
            todo["description"] = (data["description"] or "").strip()
        if "completed" in data:
            if not isinstance(data["completed"], bool):
                return jsonify({"error": "completed must be a boolean"}), 400
            todo["completed"] = data["completed"]
        return jsonify(todo), 200

    @app.delete("/todos/<tid>")
    def delete_todo(tid):
        if tid not in todos:
            return jsonify({"error": "Todo not found"}), 404
        del todos[tid]
        return "", 204

    return app


if __name__ == "__main__":  # pragma: no cover
    create_app().run(port=3000, debug=True)
