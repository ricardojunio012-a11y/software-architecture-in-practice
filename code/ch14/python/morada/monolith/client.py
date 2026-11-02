# The client the monolith uses to talk to the Communications service: the
# consumer of the contract. It interprets the responses the service promises.
import json
import urllib.error
import urllib.request


class CommunicationsClient:
    def __init__(self, url: str):
        self._url = url

    def send(self, id: str, text: str) -> dict:
        request = urllib.request.Request(
            f"{self._url}/notices",
            data=json.dumps({"id": id, "text": text}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request) as response:
                body = json.loads(response.read())
                return {"ok": True, "duplicate": body["status"] == "duplicate"}
        except urllib.error.HTTPError as error:
            return {"ok": False, "error": json.loads(error.read())["error"]}
