import pytest
from discount import apply_discount


# --- Normal cases ---
def test_no_discount():
    assert apply_discount(100) == 100.0


def test_vip():
    assert apply_discount(100, "vip") == 85.0


def test_regular():
    assert apply_discount(100, "regular") == 95.0


def test_unknown_customer_type_no_discount():
    assert apply_discount(100, "guest") == 100.0


def test_save10_coupon():
    assert apply_discount(100, None, "SAVE10") == 90.0


def test_save20_coupon():
    assert apply_discount(100, None, "SAVE20") == 80.0


# --- Combination: coupon vs customer (max wins) ---
def test_vip_with_save10_keeps_vip():
    # vip 0.15 > coupon 0.10
    assert apply_discount(100, "vip", "SAVE10") == 85.0


def test_vip_with_save20_takes_coupon():
    # coupon 0.20 > vip 0.15
    assert apply_discount(100, "vip", "SAVE20") == 80.0


def test_regular_with_save10_takes_coupon():
    assert apply_discount(100, "regular", "SAVE10") == 90.0


def test_regular_with_save20_takes_coupon():
    assert apply_discount(100, "regular", "SAVE20") == 80.0


# --- Edge cases ---
def test_zero_price():
    assert apply_discount(0, "vip", "SAVE20") == 0.0


def test_rounding_to_two_decimals():
    # 99.99 * 0.85 = 84.9915 -> 84.99
    assert apply_discount(99.99, "vip") == 84.99


def test_invalid_coupon_ignored():
    assert apply_discount(100, "regular", "BOGUS") == 95.0


# --- Error cases ---
def test_negative_price_raises():
    with pytest.raises(ValueError, match="Invalid price"):
        apply_discount(-1)


def test_negative_price_raises_even_with_coupon():
    with pytest.raises(ValueError):
        apply_discount(-50, "vip", "SAVE20")
