# Usage: python -m morada.plugins.main <charges.json> <plugins> <output-folder>
import json
import sys
from pathlib import Path

from morada.plugins.core import Charge, Core

input_file, plugins_folder, output = sys.argv[1], sys.argv[2], Path(sys.argv[3])
core = Core()
core.load(plugins_folder)

charges = json.loads(Path(input_file).read_text(encoding="utf-8"))["charges"]
lines = [f"plugins loaded: {', '.join(core.names())}"]
for c in charges:
    lines.append(core.issue(Charge(c["unit"], c["amountCents"], c["bank"])))

output.mkdir(parents=True, exist_ok=True)
(output / "batch.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"{len(charges)} charges; output in {output}")
