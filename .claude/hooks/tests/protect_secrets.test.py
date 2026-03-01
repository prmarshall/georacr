#!/usr/bin/env python3
"""Tests for the protect_secrets.py UserPromptSubmit hook."""

import json
import os
import subprocess
import sys

HOOK = os.path.join(os.path.dirname(__file__), "..", "protect_secrets.py")

TESTS = [
    # (prompt, should_block, label)
    ("sk-" + "a" * 48, True, "Anthropic/OpenAI key"),
    ("here is my key: sk-" + "Abc123xYz" * 5 + "AbC", True, "key embedded in text"),
    ("AIza" + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r", True, "Google Cloud key"),
    ("-----BEGIN RSA PRIVATE KEY-----", True, "RSA private key"),
    ("please help me fix this bug", False, "normal prompt"),
    ("what does sk mean in skating?", False, "sk without key pattern"),
    ("set the color to #AABB33", False, "hex color code"),
    ("", False, "empty prompt"),
]


def main() -> None:
    passed = 0
    failed = 0

    for prompt, should_block, label in TESTS:
        inp = json.dumps({"prompt": prompt})
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
        print(f"  {status}  | blocked={blocked} expected={should_block} | {label}")
        if result.stderr.strip():
            print(f"         reason: {result.stderr.strip()}")

    print(f"\n{passed}/{passed + failed} passed")
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
