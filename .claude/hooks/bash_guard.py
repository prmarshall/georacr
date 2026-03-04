#!/usr/bin/env python3
import json
import re
import sys

FORBIDDEN = [
    (r"git push.*main", "Pushing to main is restricted. Use a feature branch."),
    (r"rm -rf src", "Deleting the source directory is prohibited."),
    (r"npm publish", "Manual publishing is not allowed in this workflow.")
]

# The "Core" tools Claude is allowed to use directly
# Add 'gh' to the base executables
SAFE_COMMANDS = ['ls', 'grep', 'cat', 'find', 'pwd', 'head', 'tail', 'cd', 'git', 'python3', 'pip', 'gh']

# Prevent shell trickery within the command string
BLOCKLIST_OPERATORS = [';', '&&', '||', '>', '>>', '|']

# Define specifically which 'gh' subcommands are allowed without manual approval
GH_ALLOW_LIST = [
    "repo view",
    "repo list",
    "issue list",
    "issue view",
    "pr list",
    "pr view",
    "run list",
    "run view"
]

def main() -> None:
    # 1. Parse input
    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    tool_input = hook_input.get("tool_input", {})
    command = tool_input.get("command", "")
    if not command:
        sys.exit(0)

    # 2. Tokenize and extract base executable (e.g. 'ls' from 'ls -la')
    tokens = command.split()
    if not tokens:
        sys.exit(0)
    base_cmd = tokens[0].lower()

    # 3. Special-case: mv — checked before the allow-list so the helpful hint is shown
    if base_cmd == "mv":
        sys.stderr.write(
            "BLOCKED: The 'mv' command is restricted for safety.\n"
            "HINT: If you need to rename a file, please ask the user to do it manually "
            "or create the new file using 'Write' and ask the user to remove the old one.\n"
        )
        sys.exit(2)

    # 4. Allow-list validation — reject anything not explicitly permitted
    if base_cmd not in SAFE_COMMANDS:
        sys.stderr.write(f"BLOCKED: Command '{base_cmd}' is not in the allowed list.\n")
        sys.exit(2)

    # 5. Block shell operators to prevent command injection / chaining
    if any(op in command for op in BLOCKLIST_OPERATORS):
        sys.stderr.write("BLOCKED: Command chaining or redirection (;, &&, |, etc.) is prohibited.\n")
        sys.exit(2)

    # 6. Block recursive/force deletion and force flags (string-level)
    cmd_lower = command.lower()
    if "rm -rf" in cmd_lower or "--force" in cmd_lower:
        sys.stderr.write("BLOCKED: Recursive force deletion/force flags not allowed.\n")
        sys.exit(2)

    # 7. Block -f style force flags (token-level)
    for token in tokens:
        if token.startswith("-") and not token.startswith("--") and "f" in token:
            sys.stderr.write("BLOCKED: Force flags are not allowed.\n")
            sys.exit(2)

    # 8. FORBIDDEN regex patterns (general dangerous command patterns)
    for pattern, reason in FORBIDDEN:
        if re.search(pattern, command):
            sys.stderr.write(f"BLOCKED: {reason}\nCommand: {command}\n")
            sys.exit(2)

    # 9. Special handling for 'gh' — allow only safe read-only subcommands
    if base_cmd == "gh":
        # Fail fast on dangerous action keywords before checking the subcommand allow-list
        dangerous_keywords = ['delete', 'edit', 'create', 'write', 'remove', 'secret']
        if any(word in command.lower() for word in dangerous_keywords):
            sys.stderr.write("BLOCKED: GH command contains a forbidden action keyword.\n")
            sys.exit(2)

        gh_subcommand = " ".join(tokens[1:3]).lower()  # e.g. 'repo view', 'pr list'
        if not any(gh_subcommand.startswith(allowed) for allowed in GH_ALLOW_LIST):
            sys.stderr.write(
                f"BLOCKED: GH subcommand '{gh_subcommand}' is restricted. "
                "Only read-only operations are allowed.\n"
            )
            sys.exit(2)

    sys.exit(0)

if __name__ == "__main__":
    main()