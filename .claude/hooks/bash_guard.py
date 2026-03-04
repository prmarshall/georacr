#!/usr/bin/env python3
import json
import re
import sys

# 1. Patterns that are always blocked regardless of the command
FORBIDDEN = [
    (r"git push.*main", "Pushing to main is restricted. Use a feature branch."),
    (r"rm -rf src", "Deleting the source directory is prohibited."),
    (r"npm publish", "Manual publishing is not allowed in this workflow."),
    (r"npm install", "Adding new packages is restricted. Ask the user to install dependencies."),
]

# 2. Allowed base executables
SAFE_COMMANDS = [
    'ls', 'grep', 'cat', 'find', 'pwd', 'head', 'tail', 'cd', 
    'git', 'python3', 'pip', 'gh', 
    'npm', 'npx', 'node', 'yarn' 
]

# 3. Specifically allowed 'gh' subcommands (Read-only)
GH_ALLOW_LIST = [
    "repo view", "repo list", "issue list", "issue view", 
    "pr list", "pr view", "run list", "run view"
]

# 4. Operators allowed ONLY if followed by specific safe filters
# This allows Claude to do things like: npx tsc 2>&1 | tail -20
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
    
    base_cmd = tokens[0]
    cmd_lower = command.lower()

    # --- PHASE 1: HELP HINTS ---
    if base_cmd.lower() == "mv":
        sys.stderr.write(
            "BLOCKED: The 'mv' command is restricted for safety.\n"
            "HINT: Please ask the user to rename files manually, or 'Write' a new file "
            "and ask the user to delete the old one.\n"
        )
        sys.exit(2)

    # --- PHASE 2: BASE COMMAND VALIDATION ---
    is_allowed_executable = False
    
    # Check against SAFE_COMMANDS list
    if base_cmd.lower() in SAFE_COMMANDS:
        is_allowed_executable = True
    # Allow project-local binaries (e.g. node_modules/.bin/tsc)
    elif base_cmd.startswith("node_modules/.bin/"):
        is_allowed_executable = True
    # Allow relative execution of common local scripts
    elif base_cmd.startswith("./") and any(x in base_cmd for x in ['build', 'test', 'check']):
        is_allowed_executable = True

    if not is_allowed_executable:
        sys.stderr.write(f"BLOCKED: Command '{base_cmd}' is not in the allowed list.\n")
        sys.exit(2)

    # --- PHASE 3: OPERATOR & INJECTION CHECK ---
    # We allow '2>&1' for error capturing and '|' if it leads to a safe filter
    restricted_operators = [';', '&&', '||', '>', '>>']
    if any(op in command for op in restricted_operators):
        sys.stderr.write("BLOCKED: Command chaining (; , &&) or file redirection (>) is prohibited.\n")
        sys.exit(2)

    if "|" in command:
        # Simple check: is the command after the pipe in our safe list?
        parts = [p.strip().split()[0] for p in command.split("|") if p.strip()]
        # Skip the first part (the base command) and check the rest
        for pipe_cmd in parts[1:]:
            if pipe_cmd.lower() not in SAFE_PIPE_TARGETS:
                sys.stderr.write(f"BLOCKED: Piping to '{pipe_cmd}' is not allowed.\n")
                sys.exit(2)

    # --- PHASE 4: FLAG & REGEX SECURITY ---
    if "rm -rf" in cmd_lower or "--force" in cmd_lower:
        sys.stderr.write("BLOCKED: Recursive force deletion/force flags not allowed.\n")
        sys.exit(2)

    for token in tokens:
        # Block -f but allow it if it's part of a longer allowed flag or path
        if token.startswith("-") and not token.startswith("--") and "f" in token:
            # Exception for common non-force usages (e.g. grep -F, find -f)
            if base_cmd.lower() not in ['grep', 'find', 'git']:
                sys.stderr.write("BLOCKED: Force flags (-f) are prohibited.\n")
                sys.exit(2)

    for pattern, reason in FORBIDDEN:
        if re.search(pattern, command):
            sys.stderr.write(f"BLOCKED: {reason}\n")
            sys.exit(2)

    # --- PHASE 5: TOOL-SPECIFIC DEEP INSPECTION ---
    if base_cmd.lower() == "gh":
        dangerous_keywords = ['delete', 'edit', 'create', 'write', 'remove', 'secret', 'auth']
        if any(word in cmd_lower for word in dangerous_keywords):
            sys.stderr.write("BLOCKED: GH command contains a forbidden action keyword.\n")
            sys.exit(2)

        # Extract subcommand (e.g. 'repo view')
        sub_tokens = [t for t in tokens[1:] if not t.startswith("-")]
        gh_sub = " ".join(sub_tokens[:2]).lower()
        if not any(gh_sub.startswith(allowed) for allowed in GH_ALLOW_LIST):
            sys.stderr.write(f"BLOCKED: GH subcommand '{gh_sub}' is restricted to read-only.\n")
            sys.exit(2)

    sys.exit(0)

if __name__ == "__main__":
    main()