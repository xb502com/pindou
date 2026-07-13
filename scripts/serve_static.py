#!/usr/bin/env python3
from __future__ import annotations

import http.server
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'public'
PORT = 8000

if __name__ == '__main__':
    import os
    os.chdir(ROOT)
    with socketserver.TCPServer(('', PORT), http.server.SimpleHTTPRequestHandler) as httpd:
        print(f'Serving {ROOT} at http://localhost:{PORT}')
        httpd.serve_forever()
