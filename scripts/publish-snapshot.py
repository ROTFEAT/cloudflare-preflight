#!/usr/bin/env python3
"""Publisher-only file handoff: sealed memfd bytes mounted read-only for Wrangler.

This process may receive explicitly authorized publishing credentials. The
analyzer must never run here. Host administrators remain outside this boundary.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys


def sealed_snapshot(handoff):
    root = Path(handoff['stage']).resolve()
    handles = []
    try:
        for record in handoff['files']:
            relative = Path(record['path'])
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError('unsafe_snapshot_path')
            file = root / relative
            if any(p.is_symlink() for p in [file, *list(file.parents)[:len(relative.parts)]]):
                raise ValueError('snapshot_symlink')
            data = file.read_bytes()
            if hashlib.sha256(data).hexdigest() != record['sha256']:
                raise ValueError('snapshot_bytes_changed_before_sealing')
            fd = os.memfd_create('cost-safety-publisher', os.MFD_ALLOW_SEALING)
            os.write(fd, data)
            os.lseek(fd, 0, os.SEEK_SET)
            fcntl.fcntl(fd, fcntl.F_ADD_SEALS, fcntl.F_SEAL_WRITE | fcntl.F_SEAL_GROW | fcntl.F_SEAL_SHRINK | fcntl.F_SEAL_SEAL)
            handles.append((fd, str(relative)))
        return handles
    except Exception:
        for fd, _ in handles:
            os.close(fd)
        raise


def run_snapshot(handles, tools_root, command, timeout=120, offline=False):
    args = ['bwrap', '--unshare-user', '--unshare-pid', '--unshare-ipc', '--unshare-uts',
            '--die-with-parent', '--new-session', '--ro-bind', '/usr', '/usr',
            '--ro-bind', '/lib', '/lib', '--symlink', 'usr/bin', '/bin',
            '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
            '--tmpfs', '/candidate', '--ro-bind', str(Path(tools_root).resolve()), '/tools']
    if Path('/lib64').exists():
        args += ['--ro-bind', '/lib64', '/lib64']
    for name in ('/etc/ssl', '/etc/resolv.conf', '/etc/hosts', '/etc/nsswitch.conf'):
        if Path(name).exists():
            args += ['--ro-bind', name, name]
    if offline:
        args += ['--unshare-net']
    directories = sorted({str(p) for _, relative in handles for p in Path(relative).parents if str(p) != '.'}, key=lambda p: (p.count('/'), p))
    for directory in directories:
        args += ['--dir', '/candidate/' + directory]
    for fd, relative in handles:
        args += ['--ro-bind-data', str(fd), '/candidate/' + relative]
    args += ['--remount-ro', '/candidate', '--chdir', '/candidate', '--'] + command
    env = {'PATH':'/usr/bin:/bin', 'HOME':'/tmp/publisher-home', 'WRANGLER_HOME':'/tmp/wrangler-home',
           'WRANGLER_SEND_METRICS':'false', 'WRANGLER_LOG_PATH':'/tmp/wrangler-logs',
           'CLOUDFLARE_API_TOKEN':os.environ.get('CLOUDFLARE_API_TOKEN',''),
           'CLOUDFLARE_ACCOUNT_ID':os.environ.get('CLOUDFLARE_ACCOUNT_ID','')}
    try:
        return subprocess.run(args, pass_fds=[fd for fd, _ in handles], env=env, timeout=timeout).returncode
    finally:
        for fd, _ in handles:
            os.close(fd)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--handoff', required=True)
    parser.add_argument('--tools-root', required=True)
    parser.add_argument('--dry-run', action='store_true')
    options = parser.parse_args()
    try:
        handoff = json.loads(Path(options.handoff).read_text())
        if handoff['gate_status'] not in ('ALLOW','ALLOW_WITH_APPROVAL') or handoff['identity']['target']['action'] != 'deploy':
            raise ValueError('gate_did_not_allow_deploy')
        command = ['/usr/bin/node', '/tools/node_modules/wrangler/bin/wrangler.js', 'deploy', '--config', '/candidate/' + handoff['config_path'], '--no-bundle']
        environment = handoff.get('wrangler_environment')
        if environment:
            command += ['--env', environment]
        if options.dry_run:
            command += ['--dry-run', '--outdir', '/tmp/dry-run-artifact']
        sys.exit(run_snapshot(sealed_snapshot(handoff), options.tools_root, command, offline=options.dry_run))
    except Exception as error:
        print('publisher snapshot error: ' + str(error), file=sys.stderr)
        sys.exit(3)
