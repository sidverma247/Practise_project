"""README Generator — build a formatted README.md from project details.

Usable as a library (build_readme) or as an interactive CLI (python readme_generator.py).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List
import sys


@dataclass
class ProjectInfo:
    name: str
    description: str = ""
    install_steps: List[str] = field(default_factory=list)
    usage_examples: List[str] = field(default_factory=list)
    license: str = "MIT"
    badges: bool = True


def _slugify(name: str) -> str:
    return name.strip().lower().replace(" ", "-")


def build_readme(info: ProjectInfo) -> str:
    """Return a formatted README.md string for the given project info."""
    if not info.name or not info.name.strip():
        raise ValueError("Project name is required")

    lines: List[str] = []
    lines.append(f"# {info.name.strip()}")
    lines.append("")

    if info.badges:
        slug = _slugify(info.name)
        lines.append(
            f"![Build](https://img.shields.io/badge/build-passing-brightgreen) "
            f"![License](https://img.shields.io/badge/license-{info.license}-blue) "
            f"![Version](https://img.shields.io/badge/version-0.1.0-orange)"
        )
        lines.append("")

    if info.description.strip():
        lines.append(info.description.strip())
        lines.append("")

    lines.append("## Installation")
    lines.append("")
    if info.install_steps:
        lines.append("```bash")
        lines.extend(info.install_steps)
        lines.append("```")
    else:
        lines.append("_No installation steps provided._")
    lines.append("")

    lines.append("## Usage")
    lines.append("")
    if info.usage_examples:
        for ex in info.usage_examples:
            lines.append("```")
            lines.append(ex)
            lines.append("```")
            lines.append("")
    else:
        lines.append("_No usage examples provided._")
        lines.append("")

    lines.append("## License")
    lines.append("")
    lines.append(f"This project is licensed under the {info.license} License.")
    lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def _prompt_list(prompt: str) -> List[str]:
    print(f"{prompt} (one per line, blank line to finish):")
    items: List[str] = []
    while True:
        line = input("  > ").rstrip()
        if line == "":
            break
        items.append(line)
    return items


def run_cli() -> None:  # pragma: no cover - interactive
    print("=== README Generator ===")
    name = input("Project name: ").strip()
    description = input("Description: ").strip()
    install_steps = _prompt_list("Installation steps")
    usage_examples = _prompt_list("Usage examples")
    license_name = input("License [MIT]: ").strip() or "MIT"
    badges = (input("Include badges? [Y/n]: ").strip().lower() or "y") == "y"

    info = ProjectInfo(
        name=name,
        description=description,
        install_steps=install_steps,
        usage_examples=usage_examples,
        license=license_name,
        badges=badges,
    )
    content = build_readme(info)
    with open("README.generated.md", "w") as f:
        f.write(content)
    print("\nGenerated README.generated.md\n")
    print(content)


if __name__ == "__main__":  # pragma: no cover
    try:
        run_cli()
    except (KeyboardInterrupt, EOFError):
        print("\nAborted.")
        sys.exit(1)
