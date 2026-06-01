import pytest
from cache import Cache


class FakeClock:
    def __init__(self): self.t = 1000.0
    def __call__(self): return self.t
    def advance(self, s): self.t += s


def test_set_get():
    c = Cache()
    c.set("k", "v")
    assert c.get("k") == "v"


def test_get_missing_default():
    assert Cache().get("nope", "d") == "d"


def test_different_types():
    c = Cache()
    c.set("n", 42); c.set("l", [1, 2]); c.set("d", {"a": 1})
    assert c.get("n") == 42 and c.get("l") == [1, 2] and c.get("d") == {"a": 1}


def test_delete():
    c = Cache(); c.set("k", "v")
    assert c.delete("k") is True
    assert c.get("k") is None


def test_delete_missing_returns_false():
    assert Cache().delete("x") is False


def test_del_alias():
    c = Cache(); c.set("k", 1)
    assert c.del_("k") is True


def test_clear():
    c = Cache(); c.set("a", 1); c.set("b", 2)
    c.clear()
    assert c.stats().entries == 0


def test_has():
    c = Cache(); c.set("k", 1)
    assert c.has("k") is True
    assert c.has("nope") is False


def test_ttl_expiry():
    clk = FakeClock(); c = Cache(now=clk)
    c.set("k", "v", ttl=5)
    assert c.get("k") == "v"
    clk.advance(6)
    assert c.get("k") is None


def test_has_expired():
    clk = FakeClock(); c = Cache(now=clk)
    c.set("k", 1, ttl=1)
    clk.advance(2)
    assert c.has("k") is False


def test_update_ttl():
    clk = FakeClock(); c = Cache(now=clk)
    c.set("k", "v", ttl=2)
    assert c.ttl("k", 10) is True
    clk.advance(5)
    assert c.get("k") == "v"   # still alive thanks to extended ttl


def test_update_ttl_missing():
    assert Cache().ttl("nope", 10) is False


def test_stats_hits_misses():
    c = Cache(); c.set("k", 1)
    c.get("k"); c.get("k"); c.get("missing")
    s = c.stats()
    assert s.hits == 2 and s.misses == 1


def test_hit_rate():
    c = Cache(); c.set("k", 1)
    c.get("k"); c.get("missing")
    assert c.stats().hit_rate == 0.5


def test_no_ttl_never_expires():
    clk = FakeClock(); c = Cache(now=clk)
    c.set("k", "v")
    clk.advance(10_000)
    assert c.get("k") == "v"
