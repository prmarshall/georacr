#!/usr/bin/env python3
"""
PostToolUse hook for Bash.
Logs the outcome (success/failure) of every bash command to .claude_audit.log.
Always exits 0 — never blocks the workflow due to a logging failure.
"""
import json
import sys
from datetime import datetime
LOG_FILE = ".claude_audit.log"

def main() -> None:
    try:
        hook_input = json.loads(sys.stdin.read())

        tool_input = hook_input.get("tool_input", {})
        tool_result = hook_input.get("tool_result", {})
        
        command = tool_input.get("command", "unknown_cmd")
        stderr = tool_result.get("stderr", "").strip()
        exit_code = tool_result.get("exit_code", "N/A")

        status = "SUCCESS" if exit_code == 0 else f"FAILED (Code: {exit_code})"
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = (
            f"[{timestamp}] {status}\n"
            f"  CMD: {command}\n"
        )
        
        if stderr:
            truncated = stderr[:200]
            suffix = "..." if len(stderr) > 200 else ""
            log_entry += f"  ERR: {truncated}{suffix}\n"
        
        log_entry += "-" * 40 + "\n"

        # 5. Write to log
        with open(LOG_FILE, "a") as f:
            f.write(log_entry)

    except Exception:
        pass

    sys.exit(0)

if __name__ == "__main__":
    main()