# The "query" version: the delinquency query over 1 million charges, with no index,
# with an index on the wrong column, and with the right index, created by migration
# 003. The plans go to output/query; the times, which vary, go only to the terminal.
import os
import sys
from pathlib import Path

from morada.db import connect, reset_schema
from morada.migrations import apply_migrations

data = Path(sys.argv[1])
migrations_folder = str(data / "migrations")
db = connect(os.environ["DATABASE_URL"])
reset_schema(db)
applied = apply_migrations(db, migrations_folder, up_to=2)
db.execute((data / "input" / "charges.sql").read_text(encoding="utf-8"))
db.execute("ANALYZE charges")
# Without parallelism, the plan is the same on any machine and easier to read
db.execute("SET max_parallel_workers_per_gather = 0")
query = (data / "input" / "delinquency.sql").read_text(encoding="utf-8")


# The nodes that read data (table and index scans), from the JSON plan
def scans(node: dict) -> list[str]:
    children = [line for child in node.get("Plans", []) for line in scans(child)]
    if "Relation Name" not in node and "Index Name" not in node:
        return children
    table = f" on {node['Relation Name']}" if "Relation Name" in node else ""
    index = f" using index {node['Index Name']}" if "Index Name" in node else ""
    discarded = node.get("Rows Removed by Filter", 0)
    rows = f"{node['Actual Rows']} rows kept, {discarded} discarded"
    return [f"{node['Node Type']}{table}{index}: {rows}", *children]


plans: list[str] = []


def plan(title: str) -> None:
    ((explained,),) = db.execute(f"EXPLAIN (ANALYZE, FORMAT JSON) {query}").fetchone()
    plans.append(f"{len(plans) // 3 + 1}. {title}")
    plans.extend(f"   {line}" for line in scans(explained["Plan"]))
    plans.append("")
    print(f"{title}: {explained['Execution Time']:.1f} ms")


plan("no index")
db.execute("CREATE INDEX charges_due_date ON charges (due_date)")
db.execute("ANALYZE charges")
plan("index on due date only")
db.execute("DROP INDEX charges_due_date")
applied += apply_migrations(db, migrations_folder)
db.execute("ANALYZE charges")
plan("index from migration 003")

result = [
    f"unit {unit}: open charges {count}, total {total} cents"
    for unit, count, total in db.execute(query)
]
db.close()

output = data / "output" / "query"
output.mkdir(parents=True, exist_ok=True)
(output / "plans.txt").write_text("\n".join(plans), encoding="utf-8")
(output / "result.txt").write_text("\n".join(result) + "\n", encoding="utf-8")
(output / "migrations.txt").write_text("\n".join(applied) + "\n", encoding="utf-8")
