# The "leak" version: the board president of community 12 opens the delinquency
# report, first without RLS and then with RLS. Then management company 3, which
# manages communities 12 and 15, opens the same report. The faulty query is the same
# in every case.
import os
import sys
from pathlib import Path

import psycopg

from morada.db import as_community, as_management_company, connect
from morada.report import delinquents

data = Path(sys.argv[1])


def sql(file: str) -> str:
    return (data / "sql" / file).read_text(encoding="utf-8")


admin = connect(os.environ["DATABASE_URL"])
admin.execute(sql("schema.sql"))
app = connect(os.environ["APP_DATABASE_URL"])
BOARD_PRESIDENT = 12
MANAGEMENT_COMPANY = 3  # manages communities 12 and 15

log: list[str] = []


def dollars(cents: int) -> str:
    return f"${cents // 100:,}.{cents % 100:02d}"


def show(
    step: int, title: str, rows: list[tuple], allowed: tuple = (BOARD_PRESIDENT,)
) -> None:
    log.append(f"{step}. {title}")
    for community, unit, resident, amount in rows:
        warning = "" if community in allowed else "  <- another community"
        log.append(
            f"   community {community} | unit {unit} | {resident} | "
            f"{dollars(amount)}{warning}"
        )
    if not rows:
        log.append("   no rows")
    leaked = sum(1 for row in rows if row[0] not in allowed)
    log.extend([f"   rows from other communities: {leaked}", ""])


show(
    1,
    "board president's report for community 12, without RLS",
    as_community(app, BOARD_PRESIDENT, lambda: delinquents(app)),
)
admin.execute(sql("rls.sql"))
show(
    2,
    "the same report, with RLS",
    as_community(app, BOARD_PRESIDENT, lambda: delinquents(app)),
)
show(
    3,
    "with RLS, in a transaction with no community set",
    as_community(app, None, lambda: delinquents(app)),
)

log.append("4. with RLS, community 12 tries to write a charge for community 15")
try:
    as_community(
        app,
        BOARD_PRESIDENT,
        lambda: app.execute(
            "INSERT INTO charges "
            "(community_id, unit, resident, amount_cents, status) "
            "VALUES (15, '13', 'Hugh Davis', 38000, 'open')"
        ),
    )
    log.append("   written")
except psycopg.errors.InsufficientPrivilege:
    log.append("   rejected by the database: the row fails the RLS policy")

show(
    5,
    "with RLS, management company 3, which manages communities 12 and 15",
    as_management_company(app, MANAGEMENT_COMPANY, lambda: delinquents(app)),
    (12, 15),
)
log.append("6. with RLS, management company 3 tries to write a charge for community 20")
try:
    as_management_company(
        app,
        MANAGEMENT_COMPANY,
        lambda: app.execute(
            "INSERT INTO charges "
            "(community_id, unit, resident, amount_cents, status) "
            "VALUES (20, 'A-5', 'Hugh Davis', 61000, 'open')"
        ),
    )
    log.append("   written")
except psycopg.errors.InsufficientPrivilege:
    log.append("   rejected by the database: the row fails every policy")
admin.close()
app.close()

output = data / "output" / "leak"
output.mkdir(parents=True, exist_ok=True)
(output / "report.txt").write_text("\n".join(log) + "\n", encoding="utf-8")
print("leak: six steps run")
