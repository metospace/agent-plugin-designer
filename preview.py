"""Local-only static preview; Python 3 standard library, no Node required."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from functools import partial
import webbrowser

root = Path(__file__).resolve().parent
handler = partial(SimpleHTTPRequestHandler, directory=str(root))
try:
    server = ThreadingHTTPServer(('127.0.0.1', 8765), handler)
except OSError:
    raise SystemExit('Port 8765 is occupied. Close the previous preview before starting again.')
print('Open http://127.0.0.1:8765/app.html — Ctrl+C to stop. Local device only.')
webbrowser.open('http://127.0.0.1:8765/app.html')
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
