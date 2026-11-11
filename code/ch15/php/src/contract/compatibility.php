<?php
// Compares the published contract with a proposal and lists the changes.
// Incompatible is whatever can break a client that already works: removing something
// it uses, changing what it receives or requiring something it does not send.
namespace Morada\Contract;

require_once __DIR__ . '/openapi.php';

final class Change
{
    public function __construct(
        public readonly bool $compatible,
        public readonly string $text,
    ) {}
}

final class Comparison
{
    /** @var Change[] */
    public array $changes = [];

    public function __construct(
        private readonly array $old,
        private readonly array $new,
    ) {}

    public function note(bool $compatible, string $text): void
    {
        $this->changes[] = new Change($compatible, $text);
    }

    public function schemas(
        array $a,
        array $b,
        string $side,
        string $label,
        string $field,
    ): void {
        $a = resolve($this->old, $a);
        $b = resolve($this->new, $b);
        $name = $field !== '' ? $field : '(root)';
        $typeA = implode(' or ', (array) ($a['type'] ?? []));
        $typeB = implode(' or ', (array) ($b['type'] ?? []));
        if ($typeA !== $typeB) {
            $this->note(false, "$label: type changed: $name ($typeA → $typeB)");
            return;
        }
        if (isset($a['enum'], $b['enum'])) {
            // A new value in the response breaks whoever handles every case; a value
            // fewer in the request breaks whoever sends it
            [$from, $to, $warning] =
                $side === 'response'
                    ? [$a['enum'], $b['enum'], 'new enum value']
                    : [$b['enum'], $a['enum'], 'enum value removed'];
            foreach ($to as $value) {
                if (!in_array($value, $from, true)) {
                    $this->note(false, "$label: $warning: $name = $value");
                }
            }
        }
        $propsA = $a['properties'] ?? [];
        $propsB = $b['properties'] ?? [];
        $reqA = $a['required'] ?? [];
        $reqB = $b['required'] ?? [];
        $inside = fn(string $p) => $field !== '' ? "$field.$p" : $p;
        foreach ($propsA as $p => $schemaA) {
            if (!isset($propsB[$p])) {
                $this->note(false, "$label: field removed: {$inside($p)}");
                continue;
            }
            if ($side === 'response' && in_array($p, $reqA) && !in_array($p, $reqB)) {
                $this->note(false, "$label: field no longer guaranteed: {$inside($p)}");
            }
            if ($side === 'request' && !in_array($p, $reqA) && in_array($p, $reqB)) {
                $this->note(false, "$label: field became required: {$inside($p)}");
            }
            $this->schemas($schemaA, $propsB[$p], $side, $label, $inside($p));
        }
        foreach (array_keys($propsB) as $p) {
            if (isset($propsA[$p])) {
                continue;
            }
            if ($side === 'response') {
                $this->note(true, "$label: new field: {$inside($p)}");
            } elseif (in_array($p, $reqB)) {
                $this->note(false, "$label: new required field: {$inside($p)}");
            } else {
                $this->note(true, "$label: new optional field: {$inside($p)}");
            }
        }
        if (isset($a['items'], $b['items'])) {
            $this->schemas($a['items'], $b['items'], $side, $label, "{$field}[]");
        }
    }

    public function parameters(array $a, array $b, string $name): void
    {
        $key = fn(array $p) => "{$p['in']} {$p['name']}";
        $added = [];
        foreach ($b as $p) {
            $added[$key($p)] = $p;
        }
        foreach ($a as $pa) {
            $pb = $added[$key($pa)] ?? null;
            if ($pb === null) {
                $this->note(false, "$name: parameter removed: {$pa['name']}");
                continue;
            }
            if (!($pa['required'] ?? false) && ($pb['required'] ?? false)) {
                $this->note(false, "$name: parameter became required: {$pa['name']}");
            }
            $label = "$name parameter {$pa['name']}";
            $this->schemas($pa['schema'], $pb['schema'], 'request', $label, '');
        }
        $existing = array_map($key, $a);
        foreach ($b as $pb) {
            if (in_array($key($pb), $existing, true)) {
                continue;
            }
            if ($pb['required'] ?? false) {
                $this->note(false, "$name: new required parameter: {$pb['name']}");
            } else {
                $this->note(true, "$name: new optional parameter: {$pb['name']}");
            }
        }
    }

    public function operation(array $a, array $b, string $name): void
    {
        $this->parameters($a['parameters'] ?? [], $b['parameters'] ?? [], $name);
        $requestA = $a['requestBody']['content']['application/json']['schema'] ?? null;
        $requestB = $b['requestBody']['content']['application/json']['schema'] ?? null;
        if ($requestA && $requestB) {
            $this->schemas($requestA, $requestB, 'request', "$name request", '');
        }
        foreach ($a['responses'] as $status => $responseA) {
            if (!isset($b['responses'][$status])) {
                continue;
            }
            $contentA = resolve($this->old, $responseA)['content'] ?? [];
            $contentB = resolve($this->new, $b['responses'][$status])['content'] ?? [];
            foreach ($contentA as $type => $media) {
                if (!isset($contentB[$type])) {
                    continue;
                }
                $schemaB = $contentB[$type]['schema'];
                $this->schemas(
                    $media['schema'],
                    $schemaB,
                    'response',
                    "$name $status",
                    '',
                );
            }
        }
    }
}

/** @return Change[] */
function compareContracts(array $old, array $proposed): array
{
    $c = new Comparison($old, $proposed);
    foreach ($old['paths'] as $path => $operations) {
        foreach ($operations as $method => $op) {
            $name = strtoupper($method) . " $path";
            $newOp = $proposed['paths'][$path][$method] ?? null;
            if ($newOp) {
                $c->operation($op, $newOp, $name);
            } else {
                $c->note(false, "$name: operation removed");
            }
        }
    }
    foreach ($proposed['paths'] as $path => $operations) {
        foreach (array_keys($operations) as $method) {
            if (!isset($old['paths'][$path][$method])) {
                $c->note(true, strtoupper($method) . " $path: new operation");
            }
        }
    }
    return $c->changes;
}
