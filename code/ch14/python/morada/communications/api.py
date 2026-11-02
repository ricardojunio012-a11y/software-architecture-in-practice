# The HTTP API of the Communications service: the provider of the contract.
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

from morada.communications.domain import Communications, InvalidDataError


def respond(handler: BaseHTTPRequestHandler, status: int, body: dict) -> None:
    data = json.dumps(body, ensure_ascii=False).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def create_api(communications: Communications) -> HTTPServer:
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path != "/notices":
                return respond(self, 404, {"error": "not found"})
            notice = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            try:
                status = communications.send(notice["id"], notice["text"])
                respond(self, 200, {"notice": notice["id"], "status": status})
            except InvalidDataError as error:
                respond(self, 400, {"error": str(error)})

        def log_message(self, *args):
            pass

    return HTTPServer(("127.0.0.1", 0), Handler)


# Starts the server in a thread and returns its address
def start(server: HTTPServer) -> str:
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{server.server_address[1]}"
