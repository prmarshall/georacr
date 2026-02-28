#!/usr/bin/env python3
"""
PreToolUse hook for Bash commands.
Blocks dangerous operations:
  - rm -rf
  - --force
  - mv on the src folder
Exit code 2 = block the tool call with an error message.
Exit code 0 = allow.
"""

import json
import sys


BLOCKED_PATTERNS = [
    {"pattern": "rm -rf", "reason": "Recursive force deletion is not allowed."},
    {"pattern": "--force", "reason": "Force flags are not allowed."},
]

SRC_MV_REASON = "Moving the src folder is not allowed."


def check_command(command: str) -> str | None:
    """Return a reason string if the command should be blocked, else None."""
    cmd_lower = command.lower()

    for entry in BLOCKED_PATTERNS:
        if entry["pattern"] in cmd_lower:
            return entry["reason"]

    # Block -f short force flag (standalone or combined, e.g. -f, -rf, -fr)
    tokens = cmd_lower.split()
    for token in tokens:
        if token.startswith("-") and not token.startswith("--") and "f" in token:
            return "Force flags are not allowed."

    # Block `mv` when it targets the src folder (as source or destination)
    tokens = command.split()
    if "mv" in tokens:
        mv_index = tokens.index("mv")
        args = tokens[mv_index + 1:]
        # Filter out flags (tokens starting with -)
        paths = [t for t in args if not t.startswith("-")]
        for path in paths:
            if path == "src" or path.startswith("src/") or "/src" in path:
                return SRC_MV_REASON

    return None


def main() -> None:
    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        # If we can't parse input, allow the command (fail open for non-Bash calls)
        sys.exit(0)

    tool_input = hook_input.get("tool_input", {})
    command = tool_input.get("command", "")

    if not command:
        sys.exit(0)

    reason = check_command(command)
    if reason:
        # Exit code 2 = block with error message
        error = {
            "error": f"BLOCKED: {reason}\nCommand: {command}",
        }
        print(json.dumps(error))
        sys.exit(2)

    # Allow
    sys.exit(0)


if __name__ == "__main__":
    main()
