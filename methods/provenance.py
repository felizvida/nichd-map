"""Immutable settings and exact regular-file manifests for reviewed inputs."""
import hashlib
import json
from pathlib import Path, PurePosixPath


def settings_hash(settings):
    payload = json.dumps(settings, sort_keys=True, separators=(",", ":"),
                         ensure_ascii=True, allow_nan=False).encode()
    return hashlib.sha256(payload).hexdigest()


def require_same_settings(saved_hash, settings):
    current = settings_hash(settings)
    if current != saved_hash:
        raise ValueError("settings changed; start a separate run")
    return current


def file_manifest(root, relative_paths):
    """Reject traversal, links, directories and duplicate paths before hashing."""
    root = Path(root).resolve(strict=True)
    result, seen = [], set()
    for name in sorted(relative_paths):
        p = PurePosixPath(name)
        if not name or p.is_absolute() or str(p) != name or ".." in p.parts or "\\" in name or name in seen:
            raise ValueError("unsafe or duplicate relative path")
        seen.add(name)
        target = root
        for part in p.parts:
            target = target/part
            if target.is_symlink():
                raise ValueError("symlink input rejected")
        if not target.is_file() or not target.resolve().is_relative_to(root):
            raise ValueError("regular input file required")
        content = target.read_bytes()
        result.append({"path": name, "bytes": len(content),
                       "sha256": hashlib.sha256(content).hexdigest()})
    return result
