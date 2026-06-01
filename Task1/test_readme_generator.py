import pytest
from readme_generator import ProjectInfo, build_readme, _slugify


def test_basic_title():
    out = build_readme(ProjectInfo(name="My App", badges=False))
    assert out.startswith("# My App")


def test_empty_name_raises():
    with pytest.raises(ValueError):
        build_readme(ProjectInfo(name="   "))


def test_badges_included():
    out = build_readme(ProjectInfo(name="App", license="MIT", badges=True))
    assert "img.shields.io" in out
    assert "license-MIT-blue" in out


def test_badges_excluded():
    out = build_readme(ProjectInfo(name="App", badges=False))
    assert "img.shields.io" not in out


def test_install_steps_render_as_bash_block():
    out = build_readme(ProjectInfo(name="App", install_steps=["pip install app"], badges=False))
    assert "```bash" in out
    assert "pip install app" in out


def test_usage_examples_render():
    out = build_readme(ProjectInfo(name="App", usage_examples=["app --run"], badges=False))
    assert "app --run" in out


def test_description_rendered():
    out = build_readme(ProjectInfo(name="App", description="A cool tool", badges=False))
    assert "A cool tool" in out


def test_license_section():
    out = build_readme(ProjectInfo(name="App", license="Apache-2.0", badges=False))
    assert "Apache-2.0 License" in out


def test_slugify():
    assert _slugify("My Cool App") == "my-cool-app"


def test_trailing_newline():
    out = build_readme(ProjectInfo(name="App", badges=False))
    assert out.endswith("\n")
