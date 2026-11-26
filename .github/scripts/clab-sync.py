import argparse
from datetime import datetime
import fcntl
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
from shutil import copyfileobj
import subprocess
from urllib.parse import quote, urlsplit
from uuid import uuid4

SOURCE = "https://zjz1214.github.io/floorball-training/"
MANIFEST = "_clab-sync.json"
BASE = "/floorball-training"
CLAB_IP = "10.129.240.240"


def fetch(path, target, maximum):
    subprocess.run([
        "curl", "-6", "--fail", "--silent", "--show-error",
        "--connect-timeout", "10", "--max-time", "180",
        "--max-filesize", str(maximum), "--proto", "=https",
        "--output", str(target), SOURCE + quote(path),
    ], check=True)


def read_manifest(raw):
    manifest = json.loads(raw)
    if manifest.get("version") != 1 or not re.fullmatch(r"[a-f0-9]{40}", manifest.get("revision", "")):
        raise ValueError("Invalid release identity")
    timestamp = datetime.fromisoformat(manifest["generatedAt"])
    if timestamp.utcoffset() is None:
        raise ValueError("Release timestamp must have a time zone")
    entries = {}
    for item in manifest["files"]:
        name, size, digest = item["path"], item["size"], item["sha256"]
        if (not isinstance(name, str) or "\\" in name or "\x00" in name
                or any(part in ("", ".", "..") for part in name.split("/"))
                or name == MANIFEST or name in entries
                or type(size) is not int or not 0 <= size <= 1024**3
                or not re.fullmatch(r"[a-f0-9]{64}", digest)):
            raise ValueError(f"Invalid release entry {name!r}")
        entries[name] = (size, digest)
    if ("index.html" not in entries or len(entries) > 20000
            or sum(size for size, _ in entries.values()) > 1024**3
            or not any(name.endswith(".mp4") for name in entries)):
        raise ValueError("Invalid site contents")
    if any("/".join(parts[:i]) in entries for name in entries
           for parts in [name.split("/")] for i in range(1, len(parts))):
        raise ValueError("Release file conflicts with a directory")
    return manifest, timestamp, entries


def matches(path, expected):
    try:
        if not path.is_file() or path.stat().st_size != expected[0]:
            return False
        with path.open("rb") as source:
            return hashlib.file_digest(source, "sha256").hexdigest() == expected[1]
    except FileNotFoundError:
        return False


def activate(state, release):
    link = state / ("next-" + uuid4().hex)
    link.symlink_to(release)
    os.replace(link, state / "current")


def sync(state, fetch_file=fetch):
    with (state / "sync.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        manifest_path = state / "manifest.download"
        fetch_file(MANIFEST, manifest_path, 8 * 1024**2)
        raw = manifest_path.read_bytes()
        manifest, timestamp, entries = read_manifest(raw)
        release = state / "releases" / hashlib.sha256(raw).hexdigest()
        current = (state / "current").resolve()
        if release == current:
            return
        active_manifest = current / "manifest.json"
        if active_manifest.is_file():
            _, active_timestamp, _ = read_manifest(active_manifest.read_bytes())
            if timestamp <= active_timestamp:
                return

        if not (release / "manifest.json").is_file():
            updates = 0
            temporary = state / "asset.download"
            for name, expected in entries.items():
                target = release / "site" / name
                if matches(target, expected):
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                previous = current / "site" / name
                if not target.exists() and matches(previous, expected):
                    os.link(previous, target)
                    continue
                fetch_file(name, temporary, max(1, expected[0]))
                if not matches(temporary, expected):
                    raise ValueError(f"Integrity check failed for {name}")
                os.replace(temporary, target)
                updates += 1
            (release / "manifest.pending").write_bytes(raw)
            os.replace(release / "manifest.pending", release / "manifest.json")
            print(f"Verified {len(entries)} files; downloaded {updates}", flush=True)

        activate(state, release)
        print(f"Campus site updated to {manifest['revision']}", flush=True)


class CampusHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, state, **kwargs):
        self.state = state
        self.remaining = None
        super().__init__(*args, directory=str(state), **kwargs)

    def translate_path(self, url):
        path = urlsplit(url).path
        if path != BASE and not path.startswith(BASE + "/"):
            return str(self.state / "unserved")
        # SimpleHTTPRequestHandler normalizes decoded path segments.
        self.directory = str((self.state / "current").resolve() / "site")
        translated = Path(super().translate_path(path[len(BASE):] or "/"))
        if not translated.exists() and not path.endswith("/"):
            page = translated.with_name(translated.name + ".html")
            if page.is_file():
                return str(page)
        return str(translated)

    def list_directory(self, path):
        self.send_error(404)
        return None

    def send_head(self):
        path = urlsplit(self.path).path
        if path in ("/", BASE):
            self.send_response(302)
            self.send_header("Location", BASE + "/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        match = re.fullmatch(r"bytes=([0-9]{0,19})-([0-9]{0,19})", self.headers.get("Range", ""))
        if not path.lower().endswith(".mp4") or not match or not any(match.groups()):
            return super().send_head()

        target = Path(self.translate_path(self.path))
        try:
            source = target.open("rb")
        except (FileNotFoundError, IsADirectoryError):
            self.send_error(404)
            return None
        size = os.fstat(source.fileno()).st_size
        first, last = match.groups()
        start = int(first) if first else max(0, size - int(last))
        end = min(size - 1, int(last)) if first and last else size - 1
        if start > end:
            source.close()
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        source.seek(start)
        self.remaining = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", "video/mp4")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(self.remaining))
        self.end_headers()
        return source

    def copyfile(self, source, output):
        try:
            if self.remaining is None:
                copyfileobj(source, output, length=65536)
                return
            while self.remaining:
                data = source.read(min(65536, self.remaining))
                if not data:
                    return
                output.write(data)
                self.remaining -= len(data)
        except (BrokenPipeError, ConnectionResetError):
            pass


class CampusServer(ThreadingHTTPServer):
    request_queue_size = 128


if __name__ == "__main__":
    from functools import partial

    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=("sync", "serve"))
    parser.add_argument("--state", required=True, type=Path)
    parser.add_argument("--bind", choices=("127.0.0.1", CLAB_IP), default=CLAB_IP)
    parser.add_argument("--port", type=int, default=8081)
    args = parser.parse_args()
    if args.operation == "sync":
        sync(args.state.resolve())
    else:
        with CampusServer((args.bind, args.port), partial(CampusHandler, state=args.state.resolve())) as server:
            print(f"Campus site serving on {args.bind}:{args.port}", flush=True)
            server.serve_forever()
