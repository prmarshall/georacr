#!/usr/bin/env python3
"""
PreToolUse hook for Edit, Write, and MultiEdit tools.
Blocks modifications to protected paths:
  - .env (and .env.* variants)
  - .git/
  - node_modules/
Exit code 2 = block the tool call with an error message.
Exit code 0 = allow.
"""

import json
import os
import sys


PROTECTED = [
    {"prefix": ".env", "reason": "Modifying .env files is not allowed."},
    {"prefix": ".git/", "reason": "Modifying .git/ is not allowed."},
    {"prefix": "node_modules/", "reason": "Modifying node_modules/ is not allowed."},
]


def to_relative(file_path: str) -> str:
    """Convert an absolute path to a path relative to cwd."""
    try:
        return os.path.relpath(file_path, os.getcwd())
    except ValueError:
        return file_path


def is_protected(file_path: str) -> str | None:
    """Return a reason string if the file path is protected, else None."""
    normalized = to_relative(file_path)

    parts = normalized.split(os.sep)

    for entry in PROTECTED:
        prefix = entry["prefix"]
        reason = entry["reason"]

        if prefix == ".env":
            for part in parts:
                if part == ".env" or part.startswith(".env."):
                    return reason
        else:
            # e.g. ".git/" or "node_modules/" — check if any segment matches
            dir_name = prefix.rstrip("/")
            if dir_name in parts:
                return reason

    return None


def main() -> None:
    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    tool_input = hook_input.get("tool_input", {})

    # Edit and Write use "file_path"; MultiEdit uses "files" list
    paths_to_check = []

    file_path = tool_input.get("file_path", "")
    if file_path:
        paths_to_check.append(file_path)

    for file_entry in tool_input.get("files", []):
        fp = file_entry.get("file_path", "")
        if fp:
            paths_to_check.append(fp)

    for path in paths_to_check:
        reason = is_protected(path)
        if reason:
            error = {
                "error": f"BLOCKED: {reason}\nFile: {path}",
            }
            print(json.dumps(error))
            sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
