#!/usr/bin/env python3
"""
PostToolUse hook for Edit, Write, and MultiEdit tools.
Extracts the modified file path(s) from stdin JSON, then runs:
  1. npx prettier --write  (auto-format)
  2. npm run lint -- --fix  (auto-fix lint issues)
Always exits 0 — formatting/lint fixes are best-effort and should not block.
"""
import json
import subprocess
import sys


def extract_paths(tool_input: dict) -> list[str]:
    """Pull file paths from Edit/Write (file_path) or MultiEdit (files[].file_path)."""
    paths: list[str] = []

    fp = tool_input.get("file_path", "")
    if fp:
        paths.append(fp)

    for entry in tool_input.get("files", []):
        fp = entry.get("file_path", "")
        if fp:
            paths.append(fp)

    return paths


def main() -> None:
    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    paths = extract_paths(hook_input.get("tool_input", {}))
    if not paths:
        sys.exit(0)

    # 1. Format with prettier
    try:
        subprocess.run(
            ["npx", "prettier", "--write"] + paths,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception:
        pass  # best-effort

    # 2. Auto-fix lint issues
    try:
        subprocess.run(
            ["npm", "run", "lint", "--", "--fix"],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except Exception:
        pass  # best-effort

    sys.exit(0)


if __name__ == "__main__":
    main()
