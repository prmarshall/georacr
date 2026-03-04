#!/usr/bin/env python3
"""
Git staging helper — replaces direct 'git add' calls.
Claude must use this script for all staging:
  python3 .claude/hooks/safe_add.py <file> [<file> ...]

Blocks any attempt to stage files matching known sensitive patterns,
then delegates to 'git add' for everything that passes.
Exit code 1 = blocked (with reason). Exit code 0 = staged successfully.
"""
import subprocess
import sys

FORBIDDEN = [
    ".env",
    "id_rsa",
    "auth.json",
    "secrets",
    ".ssh",
    "config/private",
]


def main() -> None:
    files = sys.argv[1:]

    if not files:
        sys.stderr.write("Usage: safe_add.py <file> [<file> ...]\n")
        sys.exit(1)

    # Check every target path against the forbidden list before staging anything
    for f in files:
        for pattern in FORBIDDEN:
            if pattern in f:
                sys.stderr.write(
                    f"BLOCKED: '{f}' matches sensitive pattern '{pattern}' and cannot be staged.\n"
                    "HINT: Remove the sensitive file from the list and ask the user to handle it manually.\n"
                )
                sys.exit(1)

    result = subprocess.run(["git", "add"] + files)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
