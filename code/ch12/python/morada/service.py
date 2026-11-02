# The Communications service: the same module, now behind an HTTP API, in its own
# process and container. With FAILURES=yes, it fails on purpose: every 25th call
# it rejects the request, and every 40th call it sends the notice but "loses" the
# response.
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

from morada.communications import Communications

FAIL = os.environ.get("FAILURES") == "yes"
state = {"communications": Communications(), "calls": 0}


class Handler(BaseHTTPRequestHandler):
    def reply(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self.reply(200, {})
        self.reply(404, {"error": "not found"})

    def do_POST(self):
        size = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(size)
        # Lab only: start each run from scratch
        if self.path == "/reset":
            state.update(communications=Communications(), calls=0)
            return self.reply(200, {})
        if self.path != "/notices":
            return self.reply(404, {"error": "not found"})
        notice = json.loads(body)
        state["calls"] += 1
        if FAIL and state["calls"] % 25 == 0:
            return self.reply(503, {"error": "unavailable"})
        sent = state["communications"].send(notice["id"], notice["text"])
        if FAIL and state["calls"] % 40 == 0:
            return self.reply(503, {"error": "timed out"})
        status = "sent" if sent else "duplicate"
        self.reply(200, {"notice": notice["id"], "status": status})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("Communications listening on port 8080", flush=True)
    HTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
