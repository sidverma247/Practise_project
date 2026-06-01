import pytest
from password_checker import check_password, load_common_passwords

COMMON = {"password", "123456", "qwerty"}


def chk(pw):
    return check_password(pw, common=COMMON)


def test_common_password_is_weak():
    r = chk("password")
    assert r.rating == "Weak"
    assert any("common" in f.lower() for f in r.feedback)


def test_empty_password_weak():
    assert chk("").rating == "Weak"


def test_short_password_feedback():
    r = chk("Ab1!")
    assert any("8 characters" in f for f in r.feedback)


def test_strong_password():
    r = chk("Xy7$kLmn90!q")
    assert r.rating == "Strong"
    assert r.score == 7


def test_missing_uppercase():
    r = chk("abcdefg1!")
    assert any("uppercase" in f for f in r.feedback)


def test_missing_lowercase():
    r = chk("ABCDEFG1!")
    assert any("lowercase" in f for f in r.feedback)


def test_missing_number():
    r = chk("Abcdefgh!")
    assert any("number" in f for f in r.feedback)


def test_missing_special():
    r = chk("Abcdefgh1")
    assert any("special" in f for f in r.feedback)


def test_length_8_gives_point():
    assert chk("abcdefgh").score >= 1


def test_length_12_gives_extra():
    short = chk("Abcdefg1!")     # 9 chars
    long = chk("Abcdefg1!xyz")   # 13 chars
    assert long.score > short.score


def test_has_uppercase_point():
    assert chk("Aaaaaaaa").score >= 2  # len>=8 + upper + lower


def test_all_char_types():
    r = chk("Abcd123!xyz")
    assert r.score >= 6


def test_fair_range():
    r = chk("abcdefgh")  # len8 + lower + notcommon = 3
    assert r.rating == "Fair"


def test_good_range():
    r = chk("Abcdefg1")  # len8 + upper + lower + num + notcommon = 5
    assert r.rating == "Good"


def test_non_string_raises():
    with pytest.raises(TypeError):
        chk(12345)


def test_returns_feedback_for_perfect():
    r = chk("Xy7$kLmn90!q")
    assert r.feedback  # non-empty


def test_load_common_passwords_default():
    common = load_common_passwords()
    assert "password" in common
