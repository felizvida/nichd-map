#!/usr/bin/env python3
"""Audit the exact index or commit tree; print its content hash manifest."""
import argparse
import hashlib
import json
from pathlib import PurePosixPath
import re
import subprocess


def git(*args):
    return subprocess.check_output(['git', *args])


def check(ref=None):
    if ref is None:
        records = git('ls-files', '--stage', '-z').split(b'\0')
    else:
        records = git('ls-tree', '-r', '-z', ref).split(b'\0')
    blobs = {}
    for record in filter(None, records):
        info, path = record.split(b'\t', 1)
        mode, kind_or_hash, hash_or_stage = info.decode().split()
        if mode not in {'100644', '100755'}:
            raise ValueError('non-regular file mode')
        if ref is None and hash_or_stage != '0':
            raise ValueError('unmerged index')
        if ref is not None and kind_or_hash != 'blob':
            raise ValueError('non-blob tree entry')
        name = path.decode('utf-8')
        p = PurePosixPath(name)
        if p.is_absolute() or '..' in p.parts or str(p) != name:
            raise ValueError('unsafe public path')
        oid = kind_or_hash if ref is None else hash_or_stage
        blobs[name] = git('cat-file', 'blob', oid)
    config = json.loads(blobs['PUBLIC_FILES.json'])
    allowed = config['files']
    if len(allowed) != len(set(allowed)) or set(blobs) != set(allowed):
        raise ValueError('tree differs from explicit PUBLIC_FILES.json allowlist')
    # Patterns catch common accidental traces; semantic review is still required.
    patterns = [r'/' + r'Users/[^/\s]+', r'/' + r'home/[^/\s]+',
                r'https?://[^\s/]*\.nih\.gov', r'[\w.+-]+@nih\.gov',
                r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
                r'gh[pousr]_[A-Za-z0-9]{30,}', r'github_pat_[A-Za-z0-9_]{30,}']
    text_extensions = {'.md', '.py', '.mjs', '.yml', '.json', '.cff', '.txt'}
    manifest = []
    for name, data in sorted(blobs.items()):
        if name == 'assets/banner.png':
            if hashlib.sha256(data).hexdigest() != config['banner_sha256']:
                raise ValueError('banner differs from reviewed hash')
            if not data.startswith(b'\x89PNG\r\n\x1a\n') or len(data)>5_000_000:
                raise ValueError('unexpected banner encoding or size')
        else:
            if name not in {'.gitignore', 'LICENSE'} and PurePosixPath(name).suffix not in text_extensions:
                raise ValueError('unreviewed file type')
            if len(data)>100_000:
                raise ValueError('oversize public text')
            text = data.decode('utf-8')
            if '\0' in text or any(re.search(p, text, re.I) for p in patterns):
                raise ValueError('potential disclosure in '+name)
        manifest.append({'path': name, 'bytes': len(data),
                         'sha256': hashlib.sha256(data).hexdigest()})
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--ref', help='commit or tree to inspect')
    source.add_argument('--staged', action='store_true', help='inspect index blobs')
    args = parser.parse_args()
    print(json.dumps({'files': check(args.ref), 'status': 'pass'}, indent=2))
