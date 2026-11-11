# The "compatibility" version: compares each proposal in input/proposals with the
# published contract and says whether it can be published without breaking clients.
import sys
from pathlib import Path

from morada.contract.compatibility import compare_contracts
from morada.contract.openapi import read_contract

data = Path(sys.argv[1])
published = read_contract(str(data / "openapi" / "published" / "v1.yaml"))
folder = data / "input" / "proposals"

report = []
incompatible = 0
proposals = sorted(p.name for p in folder.iterdir())
for file in proposals:
    changes = compare_contracts(published, read_contract(str(folder / file)))
    breaks = any(not c.compatible for c in changes)
    incompatible += breaks
    report.append(f"{file}: {'INCOMPATIBLE' if breaks else 'compatible'}")
    report += [f"  {'+' if c.compatible else '-'} {c.text}" for c in changes]
report += ["", f"incompatible proposals: {incompatible} of {len(proposals)}"]

output = data / "output" / "compatibility"
output.mkdir(parents=True, exist_ok=True)
(output / "report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
print(f"compatibility: {incompatible} of {len(proposals)} incompatible")
