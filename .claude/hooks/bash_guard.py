#!/usr/bin/env python3
import json
import re
import sys

# 1. Patterns that are always blocked
FORBIDDEN = [
    (r"git push.*main", "Pushing to main is restricted. Use a feature branch."),
    (r"rm -rf src", "Deleting the source directory is prohibited."),
    (r"npm publish", "Manual publishing is not allowed in this workflow."),
    (r"npm install", "Adding new packages is restricted. Ask the user to install dependencies."),
]

SAFE_COMMANDS = [
    'ls', 'grep', 'cat', 'find', 'pwd', 'head', 'tail', 'cd', 
    'git', 'python3', 'pip', 'gh', 
    'npm', 'npx', 'node', 'yarn' 
]

GH_ALLOW_LIST = [
    "repo view", "repo list", "issue list", "issue view", 
    "pr list", "pr view", "run list", "run view"
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
    cmd_lower = command.lower()

    # --- PHASE 1: HELP HINTS ---
    if base_cmd == "mv":
        sys.stderr.write("BLOCKED: The 'mv' command is restricted for safety.\nHINT: Ask user to rename files.\n")
        sys.exit(2)

    # --- PHASE 2: BASE COMMAND VALIDATION ---
    is_allowed = base_cmd in SAFE_COMMANDS or base_cmd.startswith(("node_modules/.bin/", "./"))
    if not is_allowed:
        sys.stderr.write(f"BLOCKED: Command '{base_cmd}' is not in the allowed list.\n")
        sys.exit(2)

    # --- PHASE 3: SMART OPERATOR CHECK ---
    # This regex removes everything inside "..." and '...' before checking for operators
    # It prevents blocking a '>' or '&' that is just part of a commit message.
    stripped_cmd = re.sub(r"(['\"])(?:(?=(\\?))\2.)*?\1", "", command)
    
    # We allow 2>&1 specifically as it's common in build commands
    stripped_cmd = stripped_cmd.replace("2>&1", "")

    restricted_operators = [';', '&&', '||', '>', '>>', '<<'] # Added << for heredocs
    if any(op in stripped_cmd for op in restricted_operators):
        sys.stderr.write("BLOCKED: Command chaining or redirection found outside of quotes.\n")
        sys.exit(2)

    if "|" in stripped_cmd:
        parts = [p.strip().split()[0] for p in stripped_cmd.split("|") if p.strip()]
        for pipe_cmd in parts[1:]:
            if pipe_cmd.lower() not in SAFE_PIPE_TARGETS:
                sys.stderr.write(f"BLOCKED: Piping to '{pipe_cmd}' is not allowed.\n")
                sys.exit(2)

    # --- PHASE 4: FLAG & REGEX SECURITY ---
    if "rm -rf" in cmd_lower or "--force" in cmd_lower:
        sys.stderr.write("BLOCKED: Recursive force deletion/force flags not allowed.\n")
        sys.exit(2)

    # --- PHASE 5: TOOL-SPECIFIC ---
    if base_cmd == "gh":
        dangerous = ['delete', 'edit', 'create', 'write', 'remove', 'secret', 'auth']
        if any(word in cmd_lower for word in dangerous):
            sys.stderr.write("BLOCKED: GH command contains a forbidden action keyword.\n")
            sys.exit(2)
        
        sub_tokens = [t for t in tokens[1:] if not t.startswith("-")]
        gh_sub = " ".join(sub_tokens[:2]).lower()
        if not any(gh_sub.startswith(allowed) for allowed in GH_ALLOW_LIST):
            sys.stderr.write(f"BLOCKED: GH subcommand '{gh_sub}' is restricted.\n")
            sys.exit(2)

    sys.exit(0)

if __name__ == "__main__":
    main()