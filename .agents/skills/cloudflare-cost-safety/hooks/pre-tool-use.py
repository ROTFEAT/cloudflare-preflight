#!/usr/bin/env python3
"""Bounded launcher: analysis failures return a supported denial, never a pass."""
import json
import os
import pathlib
import subprocess
import sys


def deny():
    return {"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
            "permissionDecisionReason": "Cloudflare cost safety Hook could not verify this call. Stop the operation, repair the Hook, and use $cloudflare-cost-safety before a Cloudflare release."}}


try:
    data = sys.stdin.buffer.read(1048577)
    if len(data) > 1048576:
        raise ValueError("input_limit")
    event = json.loads(data)
    if (not isinstance(event, dict) or event.get("hook_event_name") != "PreToolUse"
            or not isinstance(event.get("tool_name"), str) or not isinstance(event.get("cwd"), str)
            or not os.path.isabs(event["cwd"])):
        raise ValueError("invalid_event")
    tool = event["tool_name"]
    if tool not in ("Bash", "exec_command", "shell", "shell_command"):
        relevant_mcp = tool.startswith("mcp__") and any(word in json.dumps(event.get("tool_input", {})).lower() + tool.lower()
                                                       for word in ("cloudflare", "wrangler"))
        if not relevant_mcp:
            print("{}")
            sys.exit(0)
    args = sys.argv[1:]
    node = "/usr/bin/node"
    if args[:1] == ["--node"]:
        node, args = args[1], args[2:]
    if not os.path.isabs(node):
        raise ValueError("absolute_node_required")
    worker = pathlib.Path(__file__).resolve().with_suffix(".mjs")
    result = subprocess.run([node, "--max-old-space-size=128", str(worker), *args], input=data,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=8,
                            env={"PATH": "/usr/bin:/bin", "HOME": "/nonexistent", "WRANGLER_SEND_METRICS": "false"})
    if result.returncode != 0 or len(result.stdout) > 8192:
        raise ValueError("worker_failure")
    output = json.loads(result.stdout)
    if output != {} and output.get("hookSpecificOutput", {}).get("permissionDecision") != "deny":
        raise ValueError("invalid_decision")
except Exception:
    output = deny()
print(json.dumps(output, ensure_ascii=False))
