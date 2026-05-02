from __future__ import annotations

import argparse
import posixpath
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


class SpaStaticHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        parsed = urlparse(path)
        normalized = posixpath.normpath(unquote(parsed.path))
        parts = [part for part in normalized.split("/") if part and part not in {".", ".."}]

        root = Path(self.directory or ".").resolve()
        resolved = root.joinpath(*parts).resolve()
        try:
            resolved.relative_to(root)
        except ValueError:
            return str(root / "index.html")

        if resolved.exists():
            return str(resolved)

        if parsed.path.startswith("/assets/") or "." in Path(parsed.path).name:
            return str(resolved)

        return str(root / "index.html")


def main() -> None:
    parser = argparse.ArgumentParser(description="Serve the built frontend with SPA fallback.")
    parser.add_argument("--root", default="frontend/dist", help="Directory to serve")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=4173, help="Bind port")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.exists():
        raise SystemExit(f"Frontend build directory does not exist: {root}")

    handler = partial(SpaStaticHandler, directory=str(root))
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving {root} on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
