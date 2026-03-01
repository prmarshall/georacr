#!/usr/bin/env python3
"""Tests for the check_types.py PostToolUse hook."""

import json
import os
import subprocess
import sys
import tempfile

HOOK = os.path.join(os.path.dirname(__file__), "..", "check_types.py")
APP_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "src", "App.tsx")


def read_file(path: str) -> str:
    with open(path) as f:
        return f.read()


def write_file(path: str, content: str) -> None:
    with open(path, "w") as f:
        f.write(content)


def run_hook() -> tuple[int, str, str]:
    result = subprocess.run(
        [sys.executable, HOOK],
        input="{}",
        capture_output=True,
        text=True,
    )
    return result.returncode, result.stdout.strip(), result.stderr.strip()


def main() -> None:
    original = read_file(APP_FILE)
    passed = 0
    failed = 0

    # Test 1: Clean code should pass
    code, stdout, stderr = run_hook()
    ok = code == 0
    status = "PASS" if ok else "FAIL"
    passed += 1 if ok else 0
    failed += 0 if ok else 1
    print(f"  {status}  | exit={code} expected=0 | clean code passes")
    if stdout:
        print(f"         stdout: {stdout[:200]}")

    # Test 2: Type error should block
    broken = original.replace(
        "const [count, setCount] = useState(0);",
        'const [count, setCount] = useState(0);\n  const broken: number = "not a number";',
    )
    write_file(APP_FILE, broken)
    try:
        code, stdout, stderr = run_hook()
        ok = code == 2
        status = "PASS" if ok else "FAIL"
        passed += 1 if ok else 0
        failed += 0 if ok else 1
        print(f"  {status}  | exit={code} expected=2 | type error blocked")
        if stdout:
            parsed = json.loads(stdout)
            print(f"         error: {parsed['error'].splitlines()[0]}")
    finally:
        write_file(APP_FILE, original)

    # Test 3: After reverting, should pass again
    code, stdout, stderr = run_hook()
    ok = code == 0
    status = "PASS" if ok else "FAIL"
    passed += 1 if ok else 0
    failed += 0 if ok else 1
    print(f"  {status}  | exit={code} expected=0 | reverted code passes")

    print(f"\n{passed}/{passed + failed} passed")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
