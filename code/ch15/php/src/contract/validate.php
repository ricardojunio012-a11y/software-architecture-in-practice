<?php
// Checks a real response against the contract: the status must be documented, so
// must the content type, and the body must follow the schema. The body arrives from
// json_decode without associative mode: JSON objects become stdClass, lists arrays.
namespace Morada\Contract;

require_once __DIR__ . '/openapi.php';

function typeOf($value): string
{
    return match (true) {
        $value === null => 'null',
        is_bool($value) => 'boolean',
        is_int($value) => 'integer',
        is_float($value) => 'number',
        is_string($value) => 'string',
        is_array($value) => 'array',
        default => 'object',
    };
}

function validateSchema(array $contract, array $schema, $value, string $at): array
{
    $schema = resolve($contract, $schema);
    $types = (array) ($schema['type'] ?? []);
    $type = typeOf($value);
    if ($types && !in_array($type, $types, true)) {
        return ["$at: expected " . implode(' or ', $types) . ", got $type"];
    }
    if (isset($schema['enum']) && !in_array($value, $schema['enum'], true)) {
        return ["$at: value not in enum: $value"];
    }
    $errors = [];
    if ($type === 'object') {
        foreach ($schema['required'] ?? [] as $field) {
            if (!property_exists($value, $field)) {
                $errors[] = "$at.$field: required field missing";
            }
        }
        foreach ($schema['properties'] ?? [] as $field => $sub) {
            if (property_exists($value, $field)) {
                $errors = [
                    ...$errors,
                    ...validateSchema($contract, $sub, $value->$field, "$at.$field"),
                ];
            }
        }
    }
    if ($type === 'array' && isset($schema['items'])) {
        foreach ($value as $i => $item) {
            $errors = [
                ...$errors,
                ...validateSchema($contract, $schema['items'], $item, "{$at}[$i]"),
            ];
        }
    }
    return $errors;
}

function validateResponse(
    array $contract,
    string $method,
    string $path,
    int $status,
    string $type,
    $body,
): array {
    $template = findPath($contract, $path);
    $operation = $template
        ? $contract['paths'][$template][strtolower($method)] ?? null
        : null;
    if (!$operation) {
        return ["$method $path: operation not in the contract"];
    }
    $name = "$method $template $status";
    $response = resolve($contract, $operation['responses'][$status] ?? null);
    if (!$response) {
        return ["$name: status not documented"];
    }
    $content = $response['content'][$type] ?? null;
    if (!$content) {
        return ["$name: content type not documented: $type"];
    }
    $errors = validateSchema($contract, $content['schema'], $body, '$');
    return array_map(fn($error) => "$name: $error", $errors);
}
