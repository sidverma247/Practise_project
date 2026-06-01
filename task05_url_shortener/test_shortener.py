import time
import pytest
from shortener import Store, create_app


# --- Store unit tests ---
def test_shorten_returns_6char_code():
    s = Store()
    e = s.shorten("https://example.com")
    assert len(e.code) == 6


def test_resolve_returns_url():
    s = Store()
    e = s.shorten("https://example.com")
    assert s.resolve(e.code).url == "https://example.com"


def test_empty_url_raises():
    with pytest.raises(ValueError):
        Store().shorten("")


def test_custom_alias():
    s = Store()
    e = s.shorten("https://example.com", alias="promo")
    assert e.code == "promo"
    assert s.resolve("promo").url == "https://example.com"


def test_duplicate_alias_raises():
    s = Store()
    s.shorten("https://a.com", alias="x")
    with pytest.raises(ValueError):
        s.shorten("https://b.com", alias="x")


def test_dedupe_same_url():
    s = Store()
    a = s.shorten("https://same.com")
    b = s.shorten("https://same.com")
    assert a.code == b.code


def test_click_tracking():
    s = Store()
    e = s.shorten("https://example.com")
    s.resolve(e.code)
    s.resolve(e.code)
    assert s.info(e.code).clicks == 2


def test_expiry():
    s = Store()
    e = s.shorten("https://example.com", ttl=1)
    assert s.resolve(e.code) is not None
    time.sleep(1.1)
    assert s.resolve(e.code) is None


def test_resolve_unknown_code():
    assert Store().resolve("nope12") is None


# --- API tests ---
@pytest.fixture
def client():
    app = create_app()
    app.testing = True
    return app.test_client()


def test_api_shorten(client):
    r = client.post("/shorten", json={"url": "https://example.com"})
    assert r.status_code == 201
    assert len(r.get_json()["code"]) == 6


def test_api_shorten_missing_url(client):
    assert client.post("/shorten", json={}).status_code == 400


def test_api_redirect(client):
    code = client.post("/shorten", json={"url": "https://example.com"}).get_json()["code"]
    r = client.get(f"/{code}")
    assert r.status_code == 302
    assert r.headers["Location"] == "https://example.com"


def test_api_info(client):
    code = client.post("/shorten", json={"url": "https://example.com"}).get_json()["code"]
    r = client.get(f"/info/{code}")
    assert r.status_code == 200
    assert r.get_json()["url"] == "https://example.com"


def test_api_info_unknown(client):
    assert client.get("/info/zzzzzz").status_code == 404
