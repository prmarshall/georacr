import sys, json, re

# Regex for common secret patterns (API Keys, private keys, etc.)
SECRET_PATTERNS = [
    r"sk-[a-zA-Z0-9]{48}",      # Anthropic/OpenAI keys
    r"AIza[0-9A-Za-z-_]{35}",   # Google Cloud keys
    r"-----BEGIN RSA PRIVATE KEY-----"
]

def main():
    # UserPromptSubmit sends the prompt as a JSON string
    data = json.load(sys.stdin)
    prompt = data.get("prompt", "")

    for pattern in SECRET_PATTERNS:
        if re.search(pattern, prompt):
            print(f"ERROR: Secret pattern detected in your prompt! Action blocked.", file=sys.stderr)
            sys.exit(2) # Block the prompt from reaching Claude
    sys.exit(0)

if __name__ == "__main__":
    main()