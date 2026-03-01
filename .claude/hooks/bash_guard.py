#!/usr/bin/env python3
import json
import re
import sys

FORBIDDEN = [
    (r"git push.*main", "Pushing to main is restricted. Use a feature branch."),
    (r"rm -rf src", "Deleting the source directory is prohibited."),
    (r"npm publish", "Manual publishing is not allowed in this workflow.")
]

def main() -> None:
    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    tool_input = hook_input.get("tool_input", {})
    command = tool_input.get("command", "")
    if not command:
        sys.exit(0)

    # Check regex patterns
    for pattern, reason in FORBIDDEN:
        if re.search(pattern, command):
            sys.stderr.write(f"BLOCKED: {reason}\nCommand: {command}\n")
            sys.exit(2)

    cmd_lower = command.lower()
    
    # Check for rm -rf and --force (case-insensitive)
    if "rm -rf" in cmd_lower or "--force" in cmd_lower:
        sys.stderr.write(f"BLOCKED: Recursive force deletion/force flags not allowed.\nCommand: {command}\n")
        sys.exit(2)

    # Check short force flags
    tokens = cmd_lower.split()
    for token in tokens:
        if token.startswith("-") and not token.startswith("--") and "f" in token:
            sys.stderr.write(f"BLOCKED: Force flags are not allowed.\nCommand: {command}\n")
            sys.exit(2)

    # Check mv logic for src folder
    if "mv" in tokens:
        mv_index = tokens.index("mv")
        args = command.split()[mv_index + 1:]  # Use original case for paths
        paths = [t for t in args if not t.startswith("-")]
        for path in paths:
            if path == "src" or path.startswith("src/") or "/src" in path:
                sys.stderr.write(f"BLOCKED: Moving the src folder is not allowed.\nCommand: {command}\n")
                sys.exit(2)

    sys.exit(0)

if __name__ == "__main__":
    main()