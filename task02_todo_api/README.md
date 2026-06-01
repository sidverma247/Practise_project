# Task 2 — Todo List API

REST API for managing todos. In-memory storage, input validation, auto IDs.

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/todos` | List all todos |
| GET | `/todos/:id` | Get one todo |
| POST | `/todos` | Create (body: `{title, description?, completed?}`) |
| PUT | `/todos/:id` | Update fields |
| DELETE | `/todos/:id` | Delete (204) |

A todo: `{id, title, description, completed, createdAt}`.

## Run
```bash
pip install flask
python app.py        # serves on :3000
```

## Example
```bash
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Learn AI","description":"Practice prompts"}'
```

## Tests
```bash
pytest test_app.py -v --cov=app
```
