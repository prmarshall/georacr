#!/usr/bin/env python3
"""
UserPromptSubmit hook.
Scans user prompts for common secret patterns (API keys, private keys, etc.)
and blocks the prompt from reaching Claude if a match is found.
Exit code 2 = block. Exit code 0 = allow.
"""
import json
import re
import sys

# Regex for common secret patterns
SECRET_PATTERNS = [
    r"sk-[a-zA-Z0-9]{48}",            # Anthropic/OpenAI keys
    r"AIza[0-9A-Za-z-_]{35}",         # Google Cloud keys
    r"-----BEGIN RSA PRIVATE KEY-----",  # RSA private keys
]


def main() -> None:
    try:
        data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    prompt = data.get("prompt", "")

    for pattern in SECRET_PATTERNS:
        if re.search(pattern, prompt):
            sys.stderr.write("BLOCKED: Secret pattern detected in your prompt. Remove it before continuing.\n")
            sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()