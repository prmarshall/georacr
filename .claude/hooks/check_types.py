#!/usr/bin/env python3
"""
PostToolUse hook for Edit, Write, and MultiEdit tools.
Runs after file modifications to verify TypeScript integrity.
  - Runs `tsc -b --noEmit` to catch type errors, unused imports, and broken types.
Exit code 2 = block with error message (forces Claude to fix).
Exit code 0 = all clear.
"""

import json
import subprocess
import sys


def run_tsc() -> tuple[int, str]:
    """Run TypeScript compiler in check-only mode. Returns (exit_code, output)."""
    result = subprocess.run(
        ["npx", "tsc", "-b", "--noEmit"],
        capture_output=True,
        text=True,
        timeout=60,
    )
    output = (result.stdout + result.stderr).strip()
    return result.returncode, output


def main() -> None:
    try:
        json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    tsc_code, tsc_output = run_tsc()

    if tsc_code != 0:
        error = {
            "error": f"TypeScript errors found. Fix before continuing.\n\n{tsc_output}",
        }
        print(json.dumps(error))
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
