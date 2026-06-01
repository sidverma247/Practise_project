from validator import validate

SCHEMA = {
    "name": {"type": "string", "required": True, "min": 2, "max": 50},
    "email": {"type": "email", "required": True},
    "age": {"type": "number", "min": 18, "max": 120},
    "website": {"type": "url", "required": False},
    "dob": {"type": "date", "required": False},
}


# --- string ---
def test_valid_object():
    r = validate({"name": "Ann", "email": "a@b.com"}, SCHEMA)
    assert r.valid


def test_string_too_short():
    r = validate({"name": "A", "email": "a@b.com"}, SCHEMA)
    assert not r.valid and any("at least 2" in e for e in r.errors)


def test_string_too_long():
    r = validate({"name": "x" * 60, "email": "a@b.com"}, SCHEMA)
    assert any("at most 50" in e for e in r.errors)


def test_string_wrong_type():
    r = validate({"name": 5, "email": "a@b.com"}, SCHEMA)
    assert any("must be a string" in e for e in r.errors)


def test_required_missing():
    r = validate({"email": "a@b.com"}, SCHEMA)
    assert any("name is required" in e for e in r.errors)


# --- email ---
def test_valid_email():
    assert validate({"name": "Ann", "email": "a@b.com"}, SCHEMA).valid


def test_invalid_email():
    r = validate({"name": "Ann", "email": "not-an-email"}, SCHEMA)
    assert any("valid email" in e for e in r.errors)


# --- number ---
def test_number_ok():
    assert validate({"name": "Ann", "email": "a@b.com", "age": 30}, SCHEMA).valid


def test_number_too_low():
    r = validate({"name": "Ann", "email": "a@b.com", "age": 10}, SCHEMA)
    assert any(">= 18" in e for e in r.errors)


def test_number_too_high():
    r = validate({"name": "Ann", "email": "a@b.com", "age": 200}, SCHEMA)
    assert any("<= 120" in e for e in r.errors)


def test_number_bool_rejected():
    r = validate({"name": "Ann", "email": "a@b.com", "age": True}, SCHEMA)
    assert any("must be a number" in e for e in r.errors)


# --- url ---
def test_valid_url():
    assert validate({"name": "Ann", "email": "a@b.com", "website": "https://x.com"}, SCHEMA).valid


def test_invalid_url():
    r = validate({"name": "Ann", "email": "a@b.com", "website": "ftp:/bad"}, SCHEMA)
    assert any("valid URL" in e for e in r.errors)


# --- date ---
def test_valid_date():
    assert validate({"name": "Ann", "email": "a@b.com", "dob": "1990-05-01"}, SCHEMA).valid


def test_invalid_date():
    r = validate({"name": "Ann", "email": "a@b.com", "dob": "01/05/1990"}, SCHEMA)
    assert any("ISO date" in e for e in r.errors)


# --- misc ---
def test_optional_absent_ok():
    assert validate({"name": "Ann", "email": "a@b.com"}, SCHEMA).valid


def test_non_object_data():
    r = validate("nope", SCHEMA)
    assert not r.valid


def test_multiple_errors_collected():
    r = validate({"name": "A", "email": "bad"}, SCHEMA)
    assert len(r.errors) >= 2
