import pytest
from app import create_app


@pytest.fixture
def client():
    app = create_app()
    app.testing = True
    return app.test_client()


def test_list_empty(client):
    r = client.get("/todos")
    assert r.status_code == 200
    assert r.get_json() == []


def test_create(client):
    r = client.post("/todos", json={"title": "Learn AI", "description": "Practice"})
    assert r.status_code == 201
    body = r.get_json()
    assert body["title"] == "Learn AI"
    assert body["completed"] is False
    assert body["id"] == "1"
    assert "createdAt" in body


def test_create_missing_title(client):
    r = client.post("/todos", json={"description": "x"})
    assert r.status_code == 400


def test_create_blank_title(client):
    r = client.post("/todos", json={"title": "   "})
    assert r.status_code == 400


def test_create_bad_completed(client):
    r = client.post("/todos", json={"title": "x", "completed": "yes"})
    assert r.status_code == 400


def test_get_one(client):
    client.post("/todos", json={"title": "A"})
    r = client.get("/todos/1")
    assert r.status_code == 200
    assert r.get_json()["title"] == "A"


def test_get_missing(client):
    assert client.get("/todos/999").status_code == 404


def test_update(client):
    client.post("/todos", json={"title": "A"})
    r = client.put("/todos/1", json={"title": "B", "completed": True})
    assert r.status_code == 200
    assert r.get_json()["title"] == "B"
    assert r.get_json()["completed"] is True


def test_update_missing(client):
    assert client.put("/todos/999", json={"title": "B"}).status_code == 404


def test_update_bad_title(client):
    client.post("/todos", json={"title": "A"})
    assert client.put("/todos/1", json={"title": ""}).status_code == 400


def test_delete(client):
    client.post("/todos", json={"title": "A"})
    assert client.delete("/todos/1").status_code == 204
    assert client.get("/todos/1").status_code == 404


def test_delete_missing(client):
    assert client.delete("/todos/999").status_code == 404


def test_ids_increment(client):
    client.post("/todos", json={"title": "A"})
    client.post("/todos", json={"title": "B"})
    ids = [t["id"] for t in client.get("/todos").get_json()]
    assert ids == ["1", "2"]
