#!/usr/bin/env python3
"""
BOPP Visualizer CLI (`boppview`)
Spins up a minimal web server displaying the interactive Vega-Lite plot
of a BOPP annotation file matching the JupyterLab extension.
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import socket
import sys
import threading
import time
import webbrowser
from http import HTTPStatus
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

try:
    from ._version import __version__
except ImportError:
    __version__ = "1.0.0"


def find_free_port(host: str = "127.0.0.1", start_port: int = 8000, max_tries: int = 50) -> int:
    """Finds an available TCP port starting from start_port."""
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
                return port
            except OSError:
                continue
    # Fallback to ephemeral port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        return sock.getsockname()[1]


def load_bopp_file(file_path: Path) -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[str]]:
    """
    Loads a BOPP file from disk.
    Returns (parsed_dict, raw_base64, error_message).
    """
    if not file_path.exists():
        return None, None, f"File not found: {file_path.resolve()}"

    if not file_path.is_file():
        return None, None, f"Path is not a regular file: {file_path.resolve()}"

    try:
        raw_bytes = file_path.read_bytes()
    except Exception as e:
        return None, None, f"Could not read file {file_path}: {e}"

    if not raw_bytes:
        return None, None, f"File is empty: {file_path}"

    # Try parsing as JSON first
    try:
        text_content = raw_bytes.decode("utf-8")
        parsed = json.loads(text_content)
        if isinstance(parsed, dict):
            return parsed, None, None
    except Exception:
        pass

    # Try parsing with msgpack if available
    try:
        import msgpack  # type: ignore
        unpacked = msgpack.unpackb(raw_bytes, raw=False)
        if isinstance(unpacked, dict):
            return unpacked, None, None
    except Exception:
        pass

    # Provide base64 encoded binary data for client-side JavaScript decoder
    b64_data = base64.b64encode(raw_bytes).decode("ascii")
    return None, b64_data, None


class BoppRequestHandler(SimpleHTTPRequestHandler):
    """Minimal HTTP request handler for BOPP standalone viewer."""

    server_version = f"BOPPView/{__version__}"

    def __init__(self, *args, target_file: Path, standalone_dir: Path, theme: str = "system", **kwargs):
        self.target_file = target_file
        self.standalone_dir = standalone_dir
        self.theme = theme
        super().__init__(*args, **kwargs)

    def log_message(self, format: str, *args: Any) -> None:
        """Suppress standard access logs for static assets to keep terminal clean."""
        # Only log errors or API calls if needed
        req_line = args[0] if args else ""
        if " 404 " in req_line or " 500 " in req_line:
            sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {format % args}\n")

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_GET(self) -> None:
        clean_path = self.path.split("?")[0].rstrip("/")

        # Health / Ping
        if clean_path == "/api/ping":
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')
            return

        # Data API
        if clean_path == "/api/data":
            annotation, raw_b64, err = load_bopp_file(self.target_file)
            stat = self.target_file.stat() if self.target_file.exists() else None

            payload = {
                "filename": self.target_file.name,
                "path": str(self.target_file.resolve()),
                "size": stat.st_size if stat else 0,
                "mtime": int(stat.st_mtime) if stat else 0,
                "theme": self.theme,
                "annotation": annotation,
                "raw_base64": raw_b64,
                "error": err,
            }

            resp_bytes = json.dumps(payload, indent=2).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(resp_bytes)))
            self.end_headers()
            self.wfile.write(resp_bytes)
            return

        # Raw file download
        if clean_path == "/api/raw":
            if not self.target_file.exists():
                self.send_error(HTTPStatus.NOT_FOUND, "BOPP file not found")
                return
            raw_bytes = self.target_file.read_bytes()
            content_type, _ = mimetypes.guess_type(str(self.target_file))
            if not content_type:
                content_type = "application/octet-stream"
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(raw_bytes)))
            self.end_headers()
            self.wfile.write(raw_bytes)
            return

        # Static assets inside standalone/
        if self.path.startswith("/standalone/"):
            asset_subpath = self.path[len("/standalone/"):].split("?")[0]
            asset_file = (self.standalone_dir / asset_subpath).resolve()

            # Security check: ensure path stays within standalone_dir
            if self.standalone_dir.resolve() in asset_file.parents and asset_file.is_file():
                content_type, _ = mimetypes.guess_type(str(asset_file))
                if not content_type:
                    content_type = "application/javascript" if asset_file.suffix == ".js" else "application/octet-stream"
                asset_bytes = asset_file.read_bytes()
                self.send_response(HTTPStatus.OK)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(asset_bytes)))
                self.end_headers()
                self.wfile.write(asset_bytes)
                return

        # Default: Serve index.html
        index_file = self.standalone_dir / "index.html"
        if index_file.exists():
            html_bytes = index_file.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html_bytes)))
            self.end_headers()
            self.wfile.write(html_bytes)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Standalone index.html not found")


class ThreadedBOPPServer(HTTPServer):
    """Custom HTTP Server holding target configuration."""
    def __init__(self, server_address, target_file: Path, standalone_dir: Path, theme: str = "system"):
        self.target_file = target_file
        self.standalone_dir = standalone_dir
        self.theme = theme

        def handler_factory(*args, **kwargs):
            return BoppRequestHandler(*args, target_file=self.target_file, standalone_dir=self.standalone_dir, theme=self.theme, **kwargs)

        super().__init__(server_address, handler_factory)


def create_parser() -> argparse.ArgumentParser:
    """Creates the CLI argument parser for boppview."""
    parser = argparse.ArgumentParser(
        prog="boppview",
        description="Spins up a minimal web server displaying the interactive Vega-Lite plot of a BOPP file.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  boppview chord_annotations.bopp
  boppview beats.bopp.json --port 8080
  boppview melody.msgpack --no-browser --theme dark
        """,
    )
    parser.add_argument(
        "file",
        type=str,
        help="Path to the BOPP annotation file (.bopp, .bopp.json, .msgpack, .bin)",
    )
    parser.add_argument(
        "-p", "--port",
        type=int,
        default=None,
        help="Port to listen on (default: 8000, or first free available port)",
    )
    parser.add_argument(
        "-b", "--host", "--bind",
        dest="host",
        type=str,
        default="127.0.0.1",
        help="Host / bind IP address (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Do not open web browser automatically on startup",
    )
    parser.add_argument(
        "--theme",
        choices=["light", "dark", "system"],
        default="system",
        help="UI color theme (default: system)",
    )
    parser.add_argument(
        "-v", "--version",
        action="version",
        version=f"%(prog)s (jupyterlab_bopp {__version__})",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    """CLI main entry point for boppview."""
    parser = create_parser()
    args = parser.parse_args(argv)

    target_file = Path(args.file).expanduser().resolve()
    if not target_file.exists():
        sys.stderr.write(f"Error: BOPP file does not exist: {target_file}\n")
        return 1

    standalone_dir = Path(__file__).resolve().parent / "standalone"
    if not standalone_dir.exists():
        # Fallback to package root
        standalone_dir = Path(__file__).resolve().parent

    port = args.port
    if port is None:
        port = find_free_port(args.host, start_port=8000)

    try:
        server = ThreadedBOPPServer((args.host, port), target_file=target_file, standalone_dir=standalone_dir, theme=args.theme)
    except OSError as e:
        sys.stderr.write(f"Error starting server on {args.host}:{port}: {e}\n")
        return 1

    server_url = f"http://{args.host}:{port}/"
    if args.theme != "system":
        server_url += f"?theme={args.theme}"

    print("=" * 64)
    print(f"  BOPP Visualizer (jupyterlab_bopp v{__version__})")
    print("=" * 64)
    print(f"  File:   {target_file.name}")
    print(f"  Path:   {target_file}")
    print(f"  URL:    {server_url}")
    print("-" * 64)
    print("  Serving interactive Vega-Lite v6 plot viewer in browser.")
    print("  Press Ctrl+C to stop the server.")
    print("=" * 64)

    if not args.no_browser:
        def open_browser():
            time.sleep(0.3)
            try:
                webbrowser.open(server_url)
            except Exception:
                pass

        threading.Thread(target=open_browser, daemon=True).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down BOPP visualizer server. Goodbye!")
    finally:
        server.server_close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
