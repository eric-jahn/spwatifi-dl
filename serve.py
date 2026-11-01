#!/usr/bin/env python3
"""Tiny static server for local use.

Spotify requires loopback redirect URIs to use 127.0.0.1 (not "localhost"),
so this binds to 127.0.0.1 only and is not reachable from other machines.

Usage: python3 serve.py [port]    (default 8888)
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Serving at http://127.0.0.1:{PORT}/  (Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
