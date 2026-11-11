# The "isolation" version: two reserve fund withdrawals, always interleaved in the same
# order, under three isolation levels. Each transaction checks the balance before
# recording its withdrawal, and even so the balance can go negative.
import os
import sys
from pathlib import Path

import psycopg

from morada.db import connect, reset_schema
from morada.fund import balance, dollars, insert_withdrawal, set_up_fund
from morada.migrations import apply_migrations

data = Path(sys.argv[1])
url = os.environ["DATABASE_URL"]
db = connect(url)
reset_schema(db)
apply_migrations(db, str(data / "migrations"))

log: list[str] = []


# A whole withdrawal, with no interleaving: used on the retry
def retry(t: psycopg.Connection, level: str, amount: int, reason: str):
    t.execute(f"BEGIN ISOLATION LEVEL {level}")
    read = balance(t, 1)
    log.append(f"T2 reads the balance: {dollars(read)}")
    if read < amount:
        log.append(
            f"T2 refuses the withdrawal of {dollars(amount)}: insufficient balance"
        )
        t.execute("ROLLBACK")
        return
    insert_withdrawal(t, 1, amount, reason)
    t.execute("COMMIT")
    log.append(f"T2 records a withdrawal of {dollars(amount)} and commits")


for level in ["READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"]:
    log.append(f"== {level}")
    set_up_fund(db)
    t1 = connect(url)
    t2 = connect(url)
    t1.execute(f"BEGIN ISOLATION LEVEL {level}")
    t2.execute(f"BEGIN ISOLATION LEVEL {level}")
    log.append("T1 and T2 begin")
    read1 = balance(t1, 1)
    log.append(f"T1 reads the balance: {dollars(read1)}")
    read2 = balance(t2, 1)
    log.append(f"T2 reads the balance: {dollars(read2)}")
    if read1 >= 70000:
        insert_withdrawal(t1, 1, 70000, "gate repair")
        log.append(f"T1 records a withdrawal of {dollars(70000)}")
    if read2 >= 60000:
        insert_withdrawal(t2, 1, 60000, "facade painting")
        log.append(f"T2 records a withdrawal of {dollars(60000)}")
    t1.execute("COMMIT")
    log.append("T1 commits")
    try:
        t2.execute("COMMIT")
        log.append("T2 commits")
    except psycopg.errors.SerializationFailure:
        log.append("T2 cannot commit: serialization failure; it tries again")
        t2.execute("ROLLBACK")
        retry(t2, level, 60000, "facade painting")
    t1.close()
    t2.close()
    final = balance(db, 1)
    warning = " (negative: the rule was broken)" if final < 0 else ""
    log += [f"final balance: {dollars(final)}{warning}", ""]
db.close()

output = data / "output" / "isolation"
output.mkdir(parents=True, exist_ok=True)
(output / "run.txt").write_text("\n".join(log), encoding="utf-8")
print("isolation: three levels run")
