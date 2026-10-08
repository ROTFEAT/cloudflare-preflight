#!/usr/bin/env python3
"""Bounded SQL structural probe; SQLite is never labelled D1 billing data."""
import json
import sqlite3
import sys
import ctypes
import errno
import resource


def probe(request):
    if len(request.get("schema", "")) > 100000 or len(request.get("queries", [])) > 50:
        return {"status": "failed", "reason": "input_budget"}
    db = sqlite3.connect(":memory:")
    # Whitelist schema syntax using SQLite's authorizer; no ATTACH, triggers,
    # virtual tables, functions, file access, or user-defined extensions.
    allowed = {sqlite3.SQLITE_CREATE_TABLE, sqlite3.SQLITE_CREATE_INDEX,
               sqlite3.SQLITE_READ, sqlite3.SQLITE_INSERT, sqlite3.SQLITE_UPDATE,
               sqlite3.SQLITE_SELECT, sqlite3.SQLITE_REINDEX}
    db.set_authorizer(lambda action, a, b, c, d: sqlite3.SQLITE_OK if action in allowed else sqlite3.SQLITE_DENY)
    steps = [0]

    def tick():
        steps[0] += 1000
        return steps[0] > 2000000
    db.set_progress_handler(tick, 1000)
    try:
        db.executescript(request.get("schema", ""))
    except sqlite3.Error:
        return {"status": "unsupported", "reason": "schema_outside_create_table_index_subset", "billing_metrics": None}
    # Python 3.10 does not support disabling the callback with None (3.11+).
    # EXPLAIN never executes the prepared mutation, but must be compilable.
    db.set_authorizer(lambda *args: sqlite3.SQLITE_OK)
    results = []
    for query in request.get("queries", []):
        sql = query.get("sql", "")
        try:
            # EXPLAIN compiles the statement without running data mutations.
            count = sql.count("?")
            plan = [r[3] for r in db.execute("EXPLAIN QUERY PLAN " + sql, [1] * count)]
            results.append({"location": query["location"], "status": "passed",
                            "explain_query_plan": plan, "billing_rows_read": None,
                            "billing_rows_written": None, "metric_status": "unsupported_sqlite_is_not_d1"})
        except sqlite3.Error:
            results.append({"location": query["location"], "status": "unsupported", "reason": "query_plan_unavailable", "billing_rows_read": None})
    return {"status": "passed" if all(r["status"] == "passed" for r in results) else "unsupported", "engine": "sqlite3", "version": sqlite3.sqlite_version,
            "results": results, "operation_budget": {"max_vm_steps": 2000000, "max_queries": 50},
            "billing_metrics": None, "cloud_writes": 0}


if __name__ == "__main__":
    memory_mb = min(256, max(64, int(sys.argv[1]) if len(sys.argv) > 1 else 256))
    resource.setrlimit(resource.RLIMIT_AS, (memory_mb * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (5, 6))
    # A kernel-enforced socket denial, also when this probe is used directly.
    try:
        sec = ctypes.CDLL("libseccomp.so.2")
        sec.seccomp_init.restype = ctypes.c_void_p
        sec.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
        sec.seccomp_load.argtypes = [ctypes.c_void_p]
        ctx = sec.seccomp_init(0x7fff0000)
        for syscall in [b"socket", b"connect", b"socketpair"]:
            sec.seccomp_rule_add(ctx, 0x00050000 | errno.EACCES, sec.seccomp_syscall_resolve_name(syscall), 0)
        if sec.seccomp_load(ctx) != 0:
            raise RuntimeError("seccomp")
    except Exception:
        print(json.dumps({"status":"unsupported","reason":"network_sandbox_unavailable"}))
        sys.exit(3)
    data = sys.stdin.buffer.read(250001)
    if len(data) > 250000:
        sys.exit(1)
    try:
        request = json.loads(data)
        groups = request.get("groups")
        if groups is None:
            result = probe(request)
        elif len(groups) > 25 or sum(len(g.get("queries", [])) for g in groups) > 50:
            result = {"status": "failed", "reason": "group_query_budget"}
        else:
            reports = [probe(group) for group in groups]
            result = {"status": "passed" if all(r["status"] == "passed" for r in reports) else "unsupported",
                      "engine": "sqlite3", "version": sqlite3.sqlite_version,
                      "results": [q for r in reports for q in r.get("results", [])],
                      "groups": reports, "billing_metrics": None, "cloud_writes": 0}
        result["memory_limit_mb"] = memory_mb
        print(json.dumps(result))
    except Exception:
        print(json.dumps({"status": "failed", "reason": "probe_error", "billing_metrics": None}))
        sys.exit(1)
