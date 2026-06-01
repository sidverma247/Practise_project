"""Python port of the applyDiscount function under test."""


def apply_discount(price, customer_type=None, coupon_code=None):
    if price < 0:
        raise ValueError("Invalid price")

    discount = 0.0
    if customer_type == "vip":
        discount = 0.15
    elif customer_type == "regular":
        discount = 0.05

    if coupon_code == "SAVE20":
        discount = max(discount, 0.20)
    elif coupon_code == "SAVE10":
        discount = max(discount, 0.10)

    final_price = price * (1 - discount)
    return round(final_price * 100) / 100
