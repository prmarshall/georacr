#!/usr/bin/env python3
"""Tests for the protect_files.py PreToolUse hook."""

import json
import os
import subprocess
import sys

HOOK = os.path.join(os.path.dirname(__file__), "..", "protect_files.py")

TESTS = [
    # (file_path, should_block, label)
    ("/Users/pam/Evosol/roadglobe/.env", True, ".env absolute"),
    ("/Users/pam/Evosol/roadglobe/.env.local", True, ".env.local absolute"),
    ("/Users/pam/Evosol/roadglobe/.git/config", True, ".git/config absolute"),
    ("/Users/pam/Evosol/roadglobe/node_modules/foo/index.js", True, "node_modules absolute"),
    ("/Users/pam/Evosol/roadglobe/src/App.tsx", False, "src/App.tsx absolute"),
    (".env", True, ".env relative"),
    (".env.production", True, ".env.production relative"),
    (".git/config", True, ".git/config relative"),
    ("node_modules/foo/index.js", True, "node_modules relative"),
    ("src/App.tsx", False, "src/App.tsx relative"),
    ("src/components/Player.tsx", False, "nested src file"),
]


def main() -> None:
    passed = 0
    failed = 0

    for file_path, should_block, label in TESTS:
        inp = json.dumps({"tool_input": {"file_path": file_path}})
        result = subprocess.run(
            [sys.executable, HOOK],
            input=inp, capture_output=True, text=True,
        )
        blocked = result.returncode == 2
        ok = blocked == should_block
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"  {status}  | blocked={blocked} expected={should_block} | {label}: {file_path}")
        if result.stdout.strip():
            print(f"         output: {result.stdout.strip()}")

    print(f"\n{passed}/{passed + failed} passed")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
