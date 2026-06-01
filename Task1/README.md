# Task 1 — README Generator

A CLI + library that generates a formatted `README.md` from project details
(name, description, installation steps, usage examples, license, optional badges).

## Files
- `readme_generator.py` — `build_readme(ProjectInfo)` library function + interactive CLI
- `test_readme_generator.py` — pytest suite (10 cases)
- `SAMPLE_README.md` — example output

## Usage (CLI)
```bash
python readme_generator.py
```
Answer the prompts; output is written to `README.generated.md`.

## Usage (library)
```python
from readme_generator import ProjectInfo, build_readme
print(build_readme(ProjectInfo(name="My App", description="...", install_steps=["pip install app"])))
```

## Tests
```bash
pytest test_readme_generator.py -v
```
