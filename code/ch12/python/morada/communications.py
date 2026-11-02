# The Communications module: sends notices to the residents. It is idempotent on
# the notice id: the same notice requested twice is sent only once.


class Communications:
    def __init__(self):
        self._sent: set[str] = set()

    # Returns True if it sent the notice now and False if it had already been sent
    def send(self, id: str, text: str) -> bool:
        if id in self._sent:
            return False
        self._sent.add(id)
        return True
