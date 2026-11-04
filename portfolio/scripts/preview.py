#!/usr/bin/env python3
"""Serve the static portfolio with an external, localhost-only demo mount."""

from __future__ import annotations

import argparse
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit


PRIVATE_PREFIX = "/__private_demos__/"
ALLOWED_HOSTS = {"localhost", "127.0.0.1"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--demos",
        required=True,
        type=Path,
        help="Path to the built demo dist directory; it is mounted without being copied.",
    )
    parser.add_argument("--port", type=int, default=8899)
    return parser.parse_args()


class PortfolioHandler(BaseHTTPRequestHandler):
    server_version = "PortfolioPreview/1.0"

    @property
    def site_root(self) -> Path:
        return self.server.site_root  # type: ignore[attr-defined]

    @property
    def demos_root(self) -> Path:
        return self.server.demos_root  # type: ignore[attr-defined]

    def do_GET(self) -> None:
        self._serve(send_body=True)

    def do_HEAD(self) -> None:
        self._serve(send_body=False)

    def _serve(self, *, send_body: bool) -> None:
        if not self._valid_host():
            self._send_error(HTTPStatus.MISDIRECTED_REQUEST, send_body)
            return

        parsed = urlsplit(self.path)
        try:
            request_path = unquote(parsed.path, errors="strict")
        except UnicodeDecodeError:
            self._send_error(HTTPStatus.BAD_REQUEST, send_body)
            return

        if "\x00" in request_path or "\\" in request_path:
            self._send_error(HTTPStatus.BAD_REQUEST, send_body)
            return

        is_private = request_path.startswith(PRIVATE_PREFIX)
        root = self.demos_root if is_private else self.site_root
        relative = request_path[len(PRIVATE_PREFIX) :] if is_private else request_path.lstrip("/")

        if any(part == ".." for part in PurePosixPath(relative).parts):
            self._send_error(HTTPStatus.NOT_FOUND, send_body)
            return

        if not relative or request_path.endswith("/"):
            relative = f"{relative.rstrip('/')}/index.html".lstrip("/")

        target = (root / relative).resolve()
        try:
            target.relative_to(root)
        except ValueError:
            self._send_error(HTTPStatus.NOT_FOUND, send_body)
            return

        if target.is_dir():
            target = (target / "index.html").resolve()

        if not target.is_file():
            self._send_error(HTTPStatus.NOT_FOUND, send_body)
            return

        content_type, encoding = mimetypes.guess_type(target.name)
        try:
            content_length = target.stat().st_size
        except OSError:
            self._send_error(HTTPStatus.NOT_FOUND, send_body)
            return

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        if encoding:
            self.send_header("Content-Encoding", encoding)
        self.send_header("Content-Length", str(content_length))
        self.send_header("X-Content-Type-Options", "nosniff")

        if is_private:
            self.send_header("Cache-Control", "private, no-store, max-age=0")
            self.send_header("Content-Security-Policy", "frame-ancestors 'self'")
            self.send_header("Cross-Origin-Resource-Policy", "same-origin")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("X-Frame-Options", "SAMEORIGIN")

        self.end_headers()
        if send_body:
            with target.open("rb") as source:
                self.wfile.write(source.read())

    def _valid_host(self) -> bool:
        host = self.headers.get("Host")
        if not host:
            return False
        try:
            hostname = urlsplit(f"//{host}").hostname
        except ValueError:
            return False
        return hostname in ALLOWED_HOSTS

    def _send_error(self, status: HTTPStatus, send_body: bool) -> None:
        body = f"{status.value} {status.phrase}\n".encode()
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if send_body:
            self.wfile.write(body)

    def list_directory(self, path: str):  # pragma: no cover - defensive override
        self.send_error(HTTPStatus.NOT_FOUND)
        return None


def main() -> None:
    args = parse_args()
    site_root = Path(__file__).resolve().parent.parent
    demos_root = args.demos.expanduser().resolve()

    if not demos_root.is_dir() or not (demos_root / "index.html").is_file():
        raise SystemExit(f"Demo dist must be a directory containing index.html: {demos_root}")
    if not 1 <= args.port <= 65535:
        raise SystemExit("--port must be between 1 and 65535")

    server = ThreadingHTTPServer(("127.0.0.1", args.port), PortfolioHandler)
    server.site_root = site_root  # type: ignore[attr-defined]
    server.demos_root = demos_root  # type: ignore[attr-defined]

    print(f"Portfolio: http://127.0.0.1:{args.port}/")
    print(f"Private demos mounted from: {demos_root}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
