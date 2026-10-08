#!/usr/bin/env python3
"""Linux offline runner. No host home, credentials, network, or writable checkout.

Only run commands explicitly authorized for local execution. This is not a claim
that namespace isolation proves arbitrary native code safe on a shared kernel.
"""
import argparse
import json
import os
from pathlib import Path
import resource
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time


def run(command, cwd, timeout=10, runtime=False, max_output=65536, memory_mb=None):
    if not shutil.which("bwrap"):
        return {"status": "unsupported", "reason": "bubblewrap_required_fail_closed", "exit_code": 3}
    cwd = str(Path(cwd).resolve())
    memory_mb = memory_mb or (1024 if runtime else 512)
    command = ["/workspace" + arg[len(cwd):] if arg.startswith(cwd + "/") else arg for arg in command]
    args = ["bwrap", "--unshare-all", "--die-with-parent", "--new-session",
            "--ro-bind", "/usr", "/usr", "--ro-bind", "/lib", "/lib",
            "--symlink", "usr/bin", "/bin", "--symlink", "usr/sbin", "/sbin",
            "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp",
            "--dir", "/home", "--dir", "/home/reviewer",
            "--ro-bind", cwd, "/workspace", "--chdir", "/workspace"]
    if os.path.exists("/lib64"):
        args += ["--ro-bind", "/lib64", "/lib64"]
    # Mask credential files even when they live inside the mounted checkout.
    sensitive = re.compile(r"^(?:\.env(?:\..*)?|\.dev\.vars.*|.*\.(?:pem|key|p12)|credentials(?:\..*)?|secrets?(?:\..*)?)$", re.I)
    for directory, dirs, files in os.walk(cwd, followlinks=False):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git")]
        for name in files:
            if sensitive.match(name):
                relative = str(Path(directory, name).relative_to(cwd))
                args += ["--ro-bind", "/dev/null", "/workspace/" + relative]
    # Independent namespace has only loopback. Workerd/Vitest use local IPC.
    args += ["--clearenv", "--setenv", "PATH", "/usr/bin:/bin",
             "--setenv", "HOME", "/home/reviewer", "--setenv", "TMPDIR", "/tmp",
             "--setenv", "CI", "true", "--setenv", "NO_COLOR", "1",
             "--setenv", "WRANGLER_SEND_METRICS", "false",
             "--setenv", "NODE_OPTIONS", "--max-old-space-size=384", "--"] + command

    def limits():
        os.setsid()
        resource.setrlimit(resource.RLIMIT_CPU, (int(timeout) + 1, int(timeout) + 2))
        resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))
        resource.setrlimit(resource.RLIMIT_FSIZE, (128 * 1024 * 1024,) * 2)
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        # RLIMIT_NPROC is shared by this host UID, so a tiny value can prevent
        # namespace creation. The parent separately caps this process tree.
        resource.setrlimit(resource.RLIMIT_NPROC, (4096, 4096))
        # Workerd and Node/V8 reserve large virtual regions. Bound actual heap
        # through Node options; ordinary Python probes also receive RLIMIT_AS.
        if not runtime and not any("node" in str(a) for a in command[:1]):
            resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)
    start = time.monotonic()
    with tempfile.TemporaryFile() as output:
        child = subprocess.Popen(args, stdout=output, stderr=subprocess.STDOUT,
                                 env={"PATH": "/usr/bin:/bin"}, preexec_fn=limits)
        status = "passed"
        try:
            def process_tree(pid):
                found = [pid]
                try:
                    children = Path(f"/proc/{pid}/task/{pid}/children").read_text().split()
                    for descendant in children:
                        found += process_tree(int(descendant))
                except (OSError, ValueError):
                    pass
                return found
            while child.poll() is None:
                processes = process_tree(child.pid)
                rss = 0
                tmp_bytes = 0
                for pid in processes:
                    try:
                        for line in Path(f"/proc/{pid}/status").read_text().splitlines():
                            if line.startswith("VmRSS:"):
                                rss += int(line.split()[1]) * 1024
                    except (OSError, ValueError):
                        pass
                    try:
                        mountinfo = Path(f"/proc/{pid}/mountinfo").read_text()
                        if any(" /tmp " in line and " - tmpfs " in line for line in mountinfo.splitlines()):
                            stat = os.statvfs(f"/proc/{pid}/root/tmp")
                            tmp_bytes = max(tmp_bytes, (stat.f_blocks - stat.f_bfree) * stat.f_frsize)
                    except OSError:
                        pass
                if time.monotonic() - start > timeout:
                    status = "timeout"
                elif rss > memory_mb * 1024 * 1024:
                    status = "memory_budget_exceeded"
                elif len(processes) > (64 if runtime else 16):
                    status = "process_budget_exceeded"
                elif tmp_bytes > 256 * 1024 * 1024:
                    status = "disk_budget_exceeded"
                elif os.fstat(output.fileno()).st_size > max_output:
                    status = "output_budget_exceeded"
                if status != "passed":
                    os.killpg(child.pid, signal.SIGKILL)
                    break
                time.sleep(0.05)
            code = child.wait()
            if code and status == "passed":
                status = "failed"
        finally:
            # A child must not leave a grandchild alive after its own exit.
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        output.seek(0)
        data = output.read(max_output).decode("utf-8", "replace")
    if status == "failed" and "bwrap:" in data and any(s in data for s in ("Operation not permitted", "No permissions", "Creating new namespace failed")):
        status = "unsupported"
    return {"status": status, "exit_code": code, "output": data,
            "duration_ms": round((time.monotonic() - start) * 1000),
            "network": "isolated_namespace", "credentials": "not_inherited",
            "checkout": "read_only", "credential_files": "masked", "memory_limit_mb": memory_mb,
            "timeout_seconds": timeout, "process_group_killed": True}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=float, default=10)
    parser.add_argument("--cwd", default=os.getcwd())
    parser.add_argument("--runtime", action="store_true")
    parser.add_argument("--memory-mb", type=int)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    cmd = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not cmd or not 0 < args.timeout <= 60 or args.memory_mb is not None and not 64 <= args.memory_mb <= 2048:
        parser.error("command and timeout in (0,60] required")
    result = run(cmd, args.cwd, args.timeout, args.runtime, memory_mb=args.memory_mb)
    sys.stdout.write(result.get("output", ""))
    sys.stdout.write("\n" + json.dumps({k: v for k, v in result.items() if k != "output"}) + "\n")
    sys.exit(0 if result["status"] == "passed" else 3 if result["status"] == "unsupported" else 1)
