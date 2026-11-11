# Reading the OpenAPI contract: resolves references and finds the operation for a
# request.
import yaml


def read_contract(file: str) -> dict:
    with open(file, encoding="utf-8") as source:
        return yaml.safe_load(source)


# Replaces {"$ref": "#/components/schemas/X"} with the object it points to
def resolve(contract: dict, node):
    while isinstance(node, dict) and "$ref" in node:
        current = contract
        for part in node["$ref"][2:].split("/"):
            current = current[part]
        node = current
    return node


# The contract's path template that matches a concrete path
def find_path(contract: dict, path: str) -> str | None:
    parts = path.split("/")
    for template in contract["paths"]:
        pieces = template.split("/")
        if len(pieces) == len(parts) and all(
            p.startswith("{") or p == part for p, part in zip(pieces, parts)
        ):
            return template
    return None
