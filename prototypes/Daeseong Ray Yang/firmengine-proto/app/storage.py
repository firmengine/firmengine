"""Case-scoped immutable blobs behind a cloud-replaceable storage interface."""
from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import mimetypes
import re
from pathlib import Path, PurePosixPath
from typing import Protocol
import uuid


@dataclass(frozen=True)
class StoredObject:
    provider: str
    namespace: str
    key: str
    version: str
    sha256: str
    size: int
    content_type: str
    filename: str

    def to_dict(self):
        return asdict(self)


class StorageBackend(Protocol):
    def put(self, case_id: str, namespace: str, filename: str, content: bytes) -> StoredObject: ...
    def read(self, reference: StoredObject | dict) -> bytes: ...
    def delete(self, reference: StoredObject | dict) -> None: ...


class LocalStorage:
    provider = 'local'
    NAMESPACES = {'incoming', 'outgoing', 'valuation_evidence'}

    def __init__(self, root: Path):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key):
        relative = PurePosixPath(str(key))
        if relative.is_absolute() or '..' in relative.parts or '\\' in str(key) or ':' in str(key):
            raise ValueError('Invalid storage key')
        if (len(relative.parts) != 5 or relative.parts[0] != 'cases' or not relative.parts[1].isalnum()
                or relative.parts[2] not in self.NAMESPACES or not re.fullmatch(r'[0-9a-f]{32}', relative.parts[3])
                or not re.fullmatch(r'original(?:\.[a-zA-Z0-9]{1,11})?', relative.parts[4])):
            raise ValueError('Storage key is not a case-scoped immutable version')
        path = (self.root / Path(*relative.parts)).resolve()
        if not path.is_relative_to(self.root) or path == self.root:
            raise ValueError('Storage key leaves the configured storage root')
        return path

    def put(self, case_id, namespace, filename, content):
        if not case_id.isalnum() or namespace not in self.NAMESPACES:
            raise ValueError('Invalid case or namespace')
        filename = Path(str(filename).replace('\\', '/')).name
        suffix = Path(filename).suffix.lower()[:12]
        if suffix and not suffix[1:].isalnum():
            raise ValueError('Invalid filename extension')
        version = uuid.uuid4().hex
        key = f'cases/{case_id}/{namespace}/{version}/original{suffix}'
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=False)
        with path.open('xb') as output:
            output.write(content)
        return StoredObject(self.provider, namespace, key, version,
                            hashlib.sha256(content).hexdigest(), len(content),
                            mimetypes.guess_type(filename)[0] or 'application/octet-stream', filename)

    def local_path(self, reference):
        value = reference.to_dict() if isinstance(reference, StoredObject) else reference
        if value.get('provider') != self.provider:
            raise ValueError('This storage adapter cannot open the selected provider')
        path = self._path(value['key'])
        parts = PurePosixPath(value['key']).parts
        if value.get('namespace') != parts[2] or value.get('version') != parts[3]:
            raise ValueError('Stored object reference does not match its namespace/version')
        if not path.is_file():
            raise FileNotFoundError('Stored object was removed')
        return path

    def read(self, reference):
        path = self.local_path(reference)
        data = path.read_bytes()
        value = reference.to_dict() if isinstance(reference, StoredObject) else reference
        if hashlib.sha256(data).hexdigest() != value['sha256']:
            raise ValueError('Stored object hash mismatch')
        if len(data) != value.get('size'):
            raise ValueError('Stored object size mismatch')
        return data

    def delete(self, reference):
        self.read(reference)
        path = self.local_path(reference)
        path.unlink()
        # Only the empty, immutable version directory is removed.
        path.parent.rmdir()
