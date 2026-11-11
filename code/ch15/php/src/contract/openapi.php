<?php
// Reading the OpenAPI contract: resolves references and finds the operation for a
// request.
namespace Morada\Contract;

require_once __DIR__ . '/../../vendor/autoload.php';

use Symfony\Component\Yaml\Yaml;

function readContract(string $file): array
{
    return Yaml::parseFile($file);
}

// Replaces ['$ref' => '#/components/schemas/X'] with the array it points to
function resolve(array $contract, $node)
{
    while (is_array($node) && isset($node['$ref'])) {
        $current = $contract;
        foreach (explode('/', substr($node['$ref'], 2)) as $part) {
            $current = $current[$part];
        }
        $node = $current;
    }
    return $node;
}

// The contract's path template that matches a concrete path
function findPath(array $contract, string $path): ?string
{
    $parts = explode('/', $path);
    foreach (array_keys($contract['paths']) as $template) {
        $pieces = explode('/', $template);
        if (count($pieces) !== count($parts)) {
            continue;
        }
        $matches = true;
        foreach ($pieces as $i => $p) {
            $matches = $matches && (str_starts_with($p, '{') || $p === $parts[$i]);
        }
        if ($matches) {
            return $template;
        }
    }
    return null;
}
