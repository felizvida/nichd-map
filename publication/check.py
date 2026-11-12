#!/usr/bin/env python3
"""Audit the exact index or commit tree; print its content hash manifest."""
import argparse
import hashlib
import json
from pathlib import PurePosixPath
import re
import struct
import subprocess

TEXT_EXTENSIONS = {'.md', '.py', '.mjs', '.yml', '.json', '.cff', '.txt'}
DATA_EXTENSIONS = {'.geojson', '.json', '.md'}
TEXT_LIMIT, DATA_LIMIT, BINARY_LIMIT = 100_000, 256_000, 5_000_000
PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'
PNG_METADATA_CHUNKS = {b'tEXt', b'iTXt', b'zTXt', b'eXIf', b'tIME'}


def git(*args):
    return subprocess.check_output(['git', *args])


def png_chunks(data):
    chunks, offset = [], 8
    while offset + 8 <= len(data):
        length = struct.unpack('>I', data[offset:offset+4])[0]
        chunks.append(data[offset+4:offset+8])
        offset += 12 + length
    if offset != len(data):
        raise ValueError('malformed PNG')
    return chunks


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
    # Pinned binary assets (PNG only) and pinned sample-data files: any change needs a reviewed hash update.
    binaries = dict(config.get('binary_sha256', {}))
    if 'banner_sha256' in config:
        binaries['assets/banner.png'] = config['banner_sha256']
    data_files = config.get('data_files', {})
    for name in list(binaries) + list(data_files):
        if name not in blobs:
            raise ValueError('pinned file missing from the tree: ' + name)
    # Patterns catch common accidental traces; semantic review is still required.
    patterns = [r'/' + r'Users/[^/\s]+', r'/' + r'home/[^/\s]+',
                r'https?://[^\s/]*\.nih\.gov', r'[\w.+-]+@nih\.gov',
                r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
                r'gh[pousr]_[A-Za-z0-9]{30,}', r'github_pat_[A-Za-z0-9_]{30,}']
    manifest = []
    for name, data in sorted(blobs.items()):
        digest = hashlib.sha256(data).hexdigest()
        if name in binaries:
            if digest != binaries[name]:
                raise ValueError('binary asset differs from reviewed hash: ' + name)
            if not data.startswith(PNG_SIGNATURE) or len(data) > BINARY_LIMIT:
                raise ValueError('unexpected binary encoding or size: ' + name)
            if PNG_METADATA_CHUNKS & set(png_chunks(data)):
                raise ValueError('PNG metadata chunk in ' + name)
        else:
            suffix = PurePosixPath(name).suffix
            if name in data_files:
                entry = data_files[name]
                if digest != entry.get('sha256') or not entry.get('license') or not entry.get('source'):
                    raise ValueError('sample data differs from reviewed hash or lacks licence/source: ' + name)
                if suffix not in DATA_EXTENSIONS or len(data) > DATA_LIMIT:
                    raise ValueError('unreviewed data type or oversize data: ' + name)
            else:
                if name not in {'.gitignore', 'LICENSE'} and suffix not in TEXT_EXTENSIONS:
                    raise ValueError('unreviewed file type')
                if len(data) > TEXT_LIMIT:
                    raise ValueError('oversize public text')
            text = data.decode('utf-8')
            if '\0' in text or any(re.search(p, text, re.I) for p in patterns):
                raise ValueError('potential disclosure in '+name)
        manifest.append({'path': name, 'bytes': len(data), 'sha256': digest})
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--ref', help='commit or tree to inspect')
    source.add_argument('--staged', action='store_true', help='inspect index blobs')
    args = parser.parse_args()
    print(json.dumps({'files': check(args.ref), 'status': 'pass'}, indent=2))
