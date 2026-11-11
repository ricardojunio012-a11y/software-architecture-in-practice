# Checks a real response against the contract: the status must be documented, so
# must the content type, and the body must follow the schema.
from morada.contract.openapi import find_path, resolve


def type_of(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    return "object"


def validate_schema(contract: dict, schema: dict, value, at: str) -> list[str]:
    schema = resolve(contract, schema)
    declared = schema.get("type")
    types = declared if isinstance(declared, list) else [declared]
    type = type_of(value)
    if declared and type not in types:
        return [f"{at}: expected {' or '.join(types)}, got {type}"]
    if "enum" in schema and value not in schema["enum"]:
        return [f"{at}: value not in enum: {value}"]
    errors = []
    if type == "object":
        for field in schema.get("required", []):
            if field not in value:
                errors.append(f"{at}.{field}: required field missing")
        for field, sub in schema.get("properties", {}).items():
            if field in value:
                errors += validate_schema(contract, sub, value[field], f"{at}.{field}")
    if type == "array" and "items" in schema:
        for i, item in enumerate(value):
            errors += validate_schema(contract, schema["items"], item, f"{at}[{i}]")
    return errors


def validate_response(
    contract: dict, method: str, path: str, status: int, type: str, body
) -> list[str]:
    template = find_path(contract, path)
    operation = contract["paths"][template].get(method.lower()) if template else None
    if not operation:
        return [f"{method} {path}: operation not in the contract"]
    name = f"{method} {template} {status}"
    response = resolve(contract, operation["responses"].get(str(status)))
    if not response:
        return [f"{name}: status not documented"]
    content = response.get("content", {}).get(type)
    if not content:
        return [f"{name}: content type not documented: {type}"]
    errors = validate_schema(contract, content["schema"], body, "$")
    return [f"{name}: {error}" for error in errors]
