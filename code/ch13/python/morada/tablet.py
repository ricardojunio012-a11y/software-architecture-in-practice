# The front-desk staff app, on the tablet. Offline, it keeps the operations in a local
# queue and keeps working; on reconnect, it sends the queue to the BFF and shows the
# conflicts.
from typing import Callable

from morada.bff import StaffBff


class Tablet:
    def __init__(self, name: str, connect: Callable[[], StaffBff], log: list[str]):
        self._name = name
        self._connect = connect
        self._log = log
        self._versions: dict[str, int] = {}
        self._queue: list[dict] = []
        self._online = True
        self._counter = 0

    # The tablet talks to the BFF's address, whatever process is serving it
    @property
    def _bff(self) -> StaffBff:
        return self._connect()

    def _note(self, text: str) -> None:
        self._log.append(f"tablet {self._name} {text}")

    def open(self) -> None:
        screen = self._bff.home()
        for p in screen["pendingPackages"]:
            self._versions[p["id"]] = p["version"]
        pending = ", ".join(p["id"] for p in screen["pendingPackages"])
        expected = ", ".join(v["name"] for v in screen["expectedVisitors"])
        self._note(f"opened: packages [{pending}], expected visitors [{expected}]")

    def disconnect(self) -> None:
        self._online = False
        self._note("lost the internet")

    def operate(self, op: dict) -> None:
        self._counter += 1
        op = {"id": f"op-{self._name}{self._counter}", **op}
        if "packageId" in op:
            op["seenVersion"] = self._versions[op["packageId"]]
        if not self._online:
            self._queue.append(op)
            self._note(f"stored {self._describe(op)} in the local queue")
            return
        [(_, result)] = self._bff.sync(self._name, [op])
        self._note(f"sent {self._describe(op)}: {result}")

    # On reconnect, the queue goes as a batch, and the response may be lost on the way
    def reconnect(self, lose_response: bool) -> None:
        self._online = True
        results = self._bff.sync(self._name, self._queue)
        if lose_response:
            n = len(self._queue)
            self._note(f"came back and sent {n} operations; the response was lost")
            return
        self._show("sent", results)

    # Without a response, the tablet does not know what was applied: it resends the batch
    def resend(self) -> None:
        self._show("resent", self._bff.sync(self._name, self._queue))

    def _show(self, verb: str, results: list) -> None:
        self._note(f"{verb} {len(self._queue)} operations:")
        for op, result in results:
            self._log.append(f"  {self._describe(op)}: {result}")
        self._queue.clear()

    @staticmethod
    def _describe(op: dict) -> str:
        target = op.get("packageId") or op.get("name")
        return f"{op['id']} ({op['type']} {target})"
