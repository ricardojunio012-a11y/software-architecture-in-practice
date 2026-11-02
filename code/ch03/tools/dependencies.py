"""Measures the dependencies between the modules of one version of the code.

For each module (folder right under before/ or after/; loose files count as "main"):
  Ca  afferent coupling: how many modules depend on it
  Ce  efferent coupling: how many modules it depends on
  I   instability = Ce / (Ca + Ce): 0 = stable, 1 = unstable
and lists the dependency cycles. The metrics are Robert C. Martin's.

Usage: python3 dependencies.py <node|php|python|java|all>
"""
import re
import sys
from pathlib import Path

LANGUAGES = {
    "node": ("Node/TypeScript", "node/src", ".ts"),
    "php": ("PHP", "php/src", ".php"),
    "python": ("Python", "python/morada", ".py"),
    "java": ("Java", "java/src/main/java/morada", ".java"),
}

# Import patterns of each language
TS = re.compile(r'from\s+"(\.{1,2}/[^"]+)"')
PHP = re.compile(r"require_once\s+__DIR__\s*\.\s*'([^']+)'")
PY = re.compile(r"^\s*(?:from|import)\s+morada\.(?:before|after)\.(\w+)", re.M)
JAVA = re.compile(r"^\s*import\s+morada\.(?:before|after)\.(\w+)\.", re.M)


def module_of_file(root: Path, file: Path) -> str:
    parts = file.relative_to(root).parts
    return parts[0] if len(parts) > 1 else "main"


def dependencies(language: str, root: Path, file: Path) -> set[str]:
    text = file.read_text(encoding="utf-8")
    if language in ("node", "php"):
        pattern = TS if language == "node" else PHP
        targets = set()
        for path in pattern.findall(text):
            target = (file.parent / path.lstrip("/")).resolve()
            targets.add(module_of_file(root.resolve(), target))
        return targets
    return set((PY if language == "python" else JAVA).findall(text))


def cycles(graph: dict[str, set[str]]) -> list[list[str]]:
    """Strongly connected components with more than one module (Tarjan)."""
    index, low, stack, on_stack, result = {}, {}, [], set(), []

    def visit(v):
        index[v] = low[v] = len(index)
        stack.append(v)
        on_stack.add(v)
        for w in sorted(graph.get(v, ())):
            if w not in index:
                visit(w)
                low[v] = min(low[v], low[w])
            elif w in on_stack:
                low[v] = min(low[v], index[w])
        if low[v] == index[v]:
            component = []
            while True:
                w = stack.pop()
                on_stack.discard(w)
                component.append(w)
                if w == v:
                    break
            if len(component) > 1:
                result.append(sorted(component))

    for v in sorted(graph):
        if v not in index:
            visit(v)
    return result


def measure(language: str, version: str) -> None:
    name, folder, extension = LANGUAGES[language]
    root = Path(folder) / version
    graph: dict[str, set[str]] = {}
    for file in sorted(root.rglob(f"*{extension}")):
        module = module_of_file(root, file)
        targets = dependencies(language, root, file) - {module}
        graph.setdefault(module, set()).update(targets)
    for targets in list(graph.values()):
        for t in targets:
            graph.setdefault(t, set())
    print(f"{name}, {version}")
    print(f"  {'module':<16}{'Ca':>4}{'Ce':>4}{'I':>7}  depends on")
    for module in sorted(graph, key=lambda m: (m == "main", m)):
        ca = sum(module in targets for targets in graph.values())
        ce = len(graph[module])
        instability = f"{ce / (ca + ce):.2f}" if ca + ce else "-"
        deps = ", ".join(sorted(graph[module])) or "-"
        print(f"  {module:<16}{ca:>4}{ce:>4}{instability:>7}  {deps}")
    found = cycles(graph)
    text = "; ".join(" <-> ".join(c) for c in found) if found else "none"
    print(f"  cycles: {text}")


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "node"
    for language in LANGUAGES if target == "all" else [target]:
        for version in ("before", "after"):
            measure(language, version)
