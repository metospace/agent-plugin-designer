"""Serve only the built web app on a fixed loopback origin (Python 3)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

root = Path(__file__).resolve().parent / 'dist-web'
if not (root / 'index.html').is_file():
    raise SystemExit('Missing dist-web/index.html. Run npm ci && npm run build:web first.')
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        super().end_headers()
try:
    server = ThreadingHTTPServer(('127.0.0.1', 8765), partial(Handler, directory=str(root)))
except OSError:
    raise SystemExit('Port 8765 is occupied. Close the previous preview and retry; do not change origins unless you exported your drafts.')
print('Agent Studio Web: http://127.0.0.1:8765/\nKeep this terminal open. Ctrl+C stops the server.')
webbrowser.open('http://127.0.0.1:8765/')
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
