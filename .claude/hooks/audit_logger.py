#!/usr/bin/env python3
"""
PreToolUse hook for Bash.
Logs every bash command attempt to .claude_audit.log before execution.
Always exits 0 — never blocks the workflow due to a logging failure.
"""
import json
import sys
from datetime import datetime

LOG_FILE = ".claude_audit.log"


def main() -> None:
    try:
        data = json.loads(sys.stdin.read())
        cmd = data.get("tool_input", {}).get("command", "unknown")

        with open(LOG_FILE, "a") as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] ATTEMPT: {cmd}\n")
    except Exception:
        # Never block the workflow because logging failed
        pass

    sys.exit(0)


if __name__ == "__main__":
    main()