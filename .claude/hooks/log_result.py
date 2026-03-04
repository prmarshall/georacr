#!/usr/bin/env python3
import json
import sys
from datetime import datetime

# Path to your audit log
LOG_FILE = ".claude_audit.log"

def main():
    try:
        # 1. Read the hook input from stdin
        hook_input = json.loads(sys.stdin.read())
        
        # 2. Extract relevant data
        # 'tool_input' is what Claude sent
        # 'tool_result' is the output/error from the terminal
        tool_input = hook_input.get("tool_input", {})
        tool_result = hook_input.get("tool_result", {})
        
        command = tool_input.get("command", "unknown_cmd")
        stdout = tool_result.get("stdout", "").strip()
        stderr = tool_result.get("stderr", "").strip()
        exit_code = tool_result.get("exit_code", "N/A")

        # 3. Determine status string
        status = "SUCCESS" if exit_code == 0 else f"FAILED (Code: {exit_code})"
        
        # 4. Format the log entry
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

    except Exception as e:
        # Ensure the hook never crashes the main workflow
        pass
    
    # Hooks must exit 0 to allow the process to continue normally
    sys.exit(0)

if __name__ == "__main__":
    main()