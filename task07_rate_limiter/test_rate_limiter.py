import pytest
from rate_limiter import RateLimiter


class FakeClock:
    def __init__(self): self.t = 1000.0
    def __call__(self): return self.t
    def advance(self, secs): self.t += secs


def test_allows_under_limit():
    rl = RateLimiter(window_ms=60000, max_requests=3)
    assert rl.check("ip1").allowed
    assert rl.check("ip1").allowed
    assert rl.check("ip1").allowed


def test_blocks_over_limit():
    rl = RateLimiter(window_ms=60000, max_requests=2)
    rl.check("ip1"); rl.check("ip1")
    assert rl.check("ip1").allowed is False


def test_remaining_decrements():
    rl = RateLimiter(window_ms=60000, max_requests=5)
    assert rl.check("ip1").remaining == 4
    assert rl.check("ip1").remaining == 3


def test_limit_in_decision():
    rl = RateLimiter(window_ms=60000, max_requests=10)
    assert rl.check("ip1").limit == 10


def test_per_key_isolation():
    rl = RateLimiter(window_ms=60000, max_requests=1)
    assert rl.check("a").allowed
    assert rl.check("b").allowed   # different key unaffected
    assert rl.check("a").allowed is False


def test_window_reset():
    clk = FakeClock()
    rl = RateLimiter(window_ms=1000, max_requests=1, now=clk)
    assert rl.check("ip1").allowed
    assert rl.check("ip1").allowed is False
    clk.advance(1.1)
    assert rl.check("ip1").allowed  # new window


def test_reset_timestamp():
    clk = FakeClock()
    rl = RateLimiter(window_ms=60000, max_requests=5, now=clk)
    d = rl.check("ip1")
    assert d.reset == int(1000.0 + 60)


def test_remaining_never_negative():
    rl = RateLimiter(window_ms=60000, max_requests=1)
    rl.check("ip1"); rl.check("ip1"); d = rl.check("ip1")
    assert d.remaining == 0


def test_invalid_config_raises():
    with pytest.raises(ValueError):
        RateLimiter(window_ms=0, max_requests=10)
    with pytest.raises(ValueError):
        RateLimiter(window_ms=1000, max_requests=0)


def test_middleware_factory_returns_handler():
    from rate_limiter import rate_limit
    mw, limiter = rate_limit(window_ms=1000, max_requests=2)
    assert callable(mw)
    assert limiter.max == 2
