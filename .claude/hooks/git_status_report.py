#!/usr/bin/env python3
"""
PostToolUse hook for Bash.
After any staging command ('git add' or 'safe_add.py'), runs 'git status'
and injects the output into Claude's context so it can verify what was staged.
Always exits 0 — this hook observes, it never blocks.
"""
import json
import subprocess
import sys


def is_staging_command(command: str) -> bool:
    """Return True if the command is a git staging operation."""
    tokens = command.split()
    if len(tokens) < 2:
        return False
    # Direct: git add ...
    if tokens[0].lower() == "git" and tokens[1].lower() == "add":
        return True
    # Via helper: python3 .claude/hooks/safe_add.py ...
    if "safe_add.py" in command:
        return True
    return False


def main() -> None:
    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    command = hook_input.get("tool_input", {}).get("command", "")

    if not is_staging_command(command):
        sys.exit(0)

    try:
        result = subprocess.run(
            ["git", "status"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        output = (result.stdout + result.stderr).strip()
    except Exception as e:
        output = f"(git status failed: {e})"

    # Print JSON so Claude receives the status output in its context
    print(json.dumps({"output": f"[git status after staging]\n{output}"}))
    sys.exit(0)


if __name__ == "__main__":
    main()
