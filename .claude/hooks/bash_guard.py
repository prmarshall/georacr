#!/usr/bin/env python3
import json
import re
import sys

FORBIDDEN = [
    (r"git push.*main", "Pushing to main is restricted."),
    (r"rm -rf src", "Deleting the source directory is prohibited."),
    (r"npm publish", "Manual publishing is not allowed."),
]

SAFE_COMMANDS = [
    'ls', 'grep', 'cat', 'find', 'pwd', 'head', 'tail', 'cd', 
    'git', 'python3', 'pip', 'gh', 'npm', 'npx', 'node', 'yarn', 'mkdir', 'echo'
]

SAFE_PIPE_TARGETS = ['grep', 'tail', 'head', 'less', 'cat']

def main() -> None:
    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    tool_input = hook_input.get("tool_input", {})
    command = tool_input.get("command", "")
    if not command:
        sys.exit(0)

    tokens = command.split()
    if not tokens:
        sys.exit(0)
    
    base_cmd = tokens[0].lower()

    # 1. Immediate Help Hints
    if base_cmd == "mv":
        sys.stderr.write("BLOCKED: 'mv' is restricted. HINT: Use 'Write' for the new file and ask user to delete the old one.\n")
        sys.exit(2)

    # 2. Base Command Check
    is_allowed = base_cmd in SAFE_COMMANDS or base_cmd.startswith(("node_modules/.bin/", "./"))
    if not is_allowed:
        sys.stderr.write(f"BLOCKED: Command '{base_cmd}' not in allowed list.\n")
        sys.exit(2)
    
    # 3. Operator Check — strip quoted strings first so '>' inside commit messages isn't flagged
    stripped_cmd = re.sub(r"(['\"])(?:(?=(\\?))\2.)*?\1", " 'QUOTED_STR' ", command)
    stripped_cmd = stripped_cmd.replace("2>&1", "")

    operators = {
        '&&': "Command chaining (&&) is prohibited. Run commands one at a time.",
        '||': "Command chaining (||) is prohibited. Run commands one at a time.",
        ';':  "Command chaining (;) is prohibited.",
        '>':  "File redirection (>) is prohibited outside of quoted messages.",
        '<<': "Heredocs (<<) are prohibited. Use the 'Write' tool instead.",
    }

    for op, reason in operators.items():
        if op in stripped_cmd:
            sys.stderr.write(f"BLOCKED: {reason}\n")
            sys.exit(2)

    # 4. Pipe Validation
    if "|" in stripped_cmd:
        parts = [p.strip().split()[0] for p in stripped_cmd.split("|") if p.strip()]
        for pipe_cmd in parts[1:]:
            if pipe_cmd.lower() not in SAFE_PIPE_TARGETS and pipe_cmd != "'QUOTED_STR'":
                sys.stderr.write(f"BLOCKED: Piping to '{pipe_cmd}' is restricted.\n")
                sys.exit(2)

    # 5. Force flags & destructive patterns
    cmd_lower = command.lower()
    if "rm -rf" in cmd_lower or "--force" in cmd_lower:
        sys.stderr.write("BLOCKED: Force flags are prohibited.\n")
        sys.exit(2)

    # 6. FORBIDDEN regex patterns
    for pattern, reason in FORBIDDEN:
        if re.search(pattern, command):
            sys.stderr.write(f"BLOCKED: {reason}\n")
            sys.exit(2)

    # 7. Git add — block sensitive files (runs after all broad safety checks)
    if base_cmd == "git" and len(tokens) > 1 and tokens[1] == "add":
        sensitive_patterns = [".env", "secrets", "config/private", ".ssh"]
        if any(pattern in command for pattern in sensitive_patterns):
            sys.stderr.write("BLOCKED: Adding sensitive files to git is prohibited.\n")
            sys.exit(2)

    sys.exit(0)

if __name__ == "__main__":
    main()