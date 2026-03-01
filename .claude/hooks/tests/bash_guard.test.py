#!/usr/bin/env python3
"""Tests for the bash_guard.py PreToolUse hook."""

import base64
import json
import os
import subprocess
import sys

HOOK = os.path.join(os.path.dirname(__file__), "..", "bash_guard.py")

# Commands are base64-encoded to avoid triggering the hook when running this test.
TESTS = [
    # (base64 command, should_block, label)
    ("Z2l0IHB1c2ggb3JpZ2luIG1haW4=", True, "push to main"),
    ("cm0gLXJmIHNyYw==", True, "rm -rf src"),
    ("bnBtIHB1Ymxpc2g=", True, "npm publish"),
    ("cm0gLXJmIC90bXAvc3R1ZmY=", True, "rm -rf arbitrary"),
    ("Z2l0IHB1c2ggLS1mb3JjZSBvcmlnaW4gZGV2", True, "force push"),
    ("bHMgLWxh", False, "ls -la"),
    ("Z2l0IHN0YXR1cw==", False, "git status"),
    ("bnBtIGluc3RhbGw=", False, "npm install"),
    ("bXYgc3JjIC90bXAvYmFja3Vw", True, "mv src"),
    ("bXYgZmlsZS50eHQgb3RoZXIudHh0", False, "mv normal files"),
    ("ZWNobyBoZWxsbw==", False, "echo hello"),
]


def main() -> None:
    passed = 0
    failed = 0

    for cmd_b64, should_block, label in TESTS:
        cmd = base64.b64decode(cmd_b64).decode()
        inp = json.dumps({"tool_input": {"command": cmd}})
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
        print(f"  {status}  | blocked={blocked} expected={should_block} | {label}: {cmd}")
        if result.stderr.strip():
            print(f"         reason: {result.stderr.strip().splitlines()[0]}")

    print(f"\n{passed}/{passed + failed} passed")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
