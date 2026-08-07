#!/usr/bin/env python3
"""Dev server that refuses to let the browser cache anything.

python -m http.server sends no Cache-Control, so Chrome applies heuristic
caching and can serve a stale index.html after an edit. Use this instead:
    python3 serve.py
"""
import functools
import http.server

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    handler = functools.partial(NoCacheHandler, directory='.')
    with http.server.ThreadingHTTPServer(('', PORT), handler) as httpd:
        print(f'serving http://localhost:{PORT} with caching disabled')
        httpd.serve_forever()
