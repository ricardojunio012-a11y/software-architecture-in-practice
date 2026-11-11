# Compares the published contract with a proposal and lists the changes.
# Incompatible is whatever can break a client that already works: removing something
# it uses, changing what it receives or requiring something it does not send.
from dataclasses import dataclass

from morada.contract.openapi import resolve


@dataclass
class Change:
    compatible: bool
    text: str


def type_text(schema: dict) -> str:
    type = schema.get("type")
    return " or ".join(type) if isinstance(type, list) else str(type)


class Comparison:
    def __init__(self, old: dict, new: dict):
        self.old = old
        self.new = new
        self.changes: list[Change] = []

    def note(self, compatible: bool, text: str) -> None:
        self.changes.append(Change(compatible, text))

    def schemas(self, a: dict, b: dict, side: str, label: str, field: str) -> None:
        a = resolve(self.old, a)
        b = resolve(self.new, b)
        name = field or "(root)"
        if type_text(a) != type_text(b):
            changed = f"{name} ({type_text(a)} → {type_text(b)})"
            return self.note(False, f"{label}: type changed: {changed}")
        if "enum" in a and "enum" in b:
            # A new value in the response breaks whoever handles every case; a value
            # fewer in the request breaks whoever sends it
            if side == "response":
                old, new, warning = a["enum"], b["enum"], "new enum value"
            else:
                old, new, warning = b["enum"], a["enum"], "enum value removed"
            for value in new:
                if value not in old:
                    self.note(False, f"{label}: {warning}: {name} = {value}")
        props_a = a.get("properties", {})
        props_b = b.get("properties", {})
        req_a = a.get("required", [])
        req_b = b.get("required", [])

        def inside(p: str) -> str:
            return f"{field}.{p}" if field else p

        for p in props_a:
            if p not in props_b:
                self.note(False, f"{label}: field removed: {inside(p)}")
                continue
            if side == "response" and p in req_a and p not in req_b:
                self.note(False, f"{label}: field no longer guaranteed: {inside(p)}")
            if side == "request" and p not in req_a and p in req_b:
                self.note(False, f"{label}: field became required: {inside(p)}")
            self.schemas(props_a[p], props_b[p], side, label, inside(p))
        for p in props_b:
            if p in props_a:
                continue
            if side == "response":
                self.note(True, f"{label}: new field: {inside(p)}")
            elif p in req_b:
                self.note(False, f"{label}: new required field: {inside(p)}")
            else:
                self.note(True, f"{label}: new optional field: {inside(p)}")
        if "items" in a and "items" in b:
            self.schemas(a["items"], b["items"], side, label, f"{field}[]")

    def parameters(self, a: list, b: list, name: str) -> None:
        def key(p: dict) -> str:
            return f"{p['in']} {p['name']}"

        added = {key(p): p for p in b}
        for pa in a:
            pb = added.get(key(pa))
            if pb is None:
                self.note(False, f"{name}: parameter removed: {pa['name']}")
                continue
            if not pa.get("required") and pb.get("required"):
                self.note(False, f"{name}: parameter became required: {pa['name']}")
            label = f"{name} parameter {pa['name']}"
            self.schemas(pa["schema"], pb["schema"], "request", label, "")
        existing = {key(p) for p in a}
        for pb in b:
            if key(pb) in existing:
                continue
            if pb.get("required"):
                self.note(False, f"{name}: new required parameter: {pb['name']}")
            else:
                self.note(True, f"{name}: new optional parameter: {pb['name']}")

    def operation(self, a: dict, b: dict, name: str) -> None:
        self.parameters(a.get("parameters", []), b.get("parameters", []), name)

        def request(op: dict):
            content = op.get("requestBody", {}).get("content", {})
            return content.get("application/json", {}).get("schema")

        if request(a) and request(b):
            self.schemas(request(a), request(b), "request", f"{name} request", "")
        for status, response_a in a["responses"].items():
            if status not in b["responses"]:
                continue
            content_a = resolve(self.old, response_a).get("content", {})
            content_b = resolve(self.new, b["responses"][status]).get("content", {})
            for type, media in content_a.items():
                if type not in content_b:
                    continue
                schema_b = content_b[type]["schema"]
                self.schemas(
                    media["schema"], schema_b, "response", f"{name} {status}", ""
                )


def compare_contracts(old: dict, proposed: dict) -> list[Change]:
    c = Comparison(old, proposed)
    for path, operations in old["paths"].items():
        for method, op in operations.items():
            name = f"{method.upper()} {path}"
            new_op = proposed["paths"].get(path, {}).get(method)
            if new_op:
                c.operation(op, new_op, name)
            else:
                c.note(False, f"{name}: operation removed")
    for path, operations in proposed["paths"].items():
        for method in operations:
            if method not in old["paths"].get(path, {}):
                c.note(True, f"{method.upper()} {path}: new operation")
    return c.changes
