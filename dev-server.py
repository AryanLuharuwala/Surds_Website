#!/usr/bin/env python3
"""Local dev server that replicates vercel.json's route rewrites.

python -m http.server has no concept of rewrites, so /enterprise and
/card-tour 404 locally even though they work on Vercel. This mirrors
vercel.json's exact-path routes so local testing matches production.
"""
import http.server
import socketserver

ROUTES = {
    "/": "/views/main/index.html",
    "/enterprise": "/views/enterprise/index.html",
    "/card-tour": "/views/card-tour/index.html",
}

class RewriteHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path in ROUTES:
            self.path = ROUTES[self.path]
        return super().do_GET()

PORT = 8000
with socketserver.TCPServer(("", PORT), RewriteHandler) as httpd:
    print(f"Serving on http://localhost:{PORT} (mirrors vercel.json routes)")
    httpd.serve_forever()
