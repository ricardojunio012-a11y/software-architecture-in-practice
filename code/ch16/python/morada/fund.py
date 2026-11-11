# The reserve fund: the balance is the sum of the entries, and a withdrawal can only be
# recorded if there is enough balance.
import psycopg


def set_up_fund(db: psycopg.Connection) -> None:
    db.execute("TRUNCATE entries")
    db.execute("INSERT INTO funds VALUES (1, 1234) ON CONFLICT DO NOTHING")
    db.execute(
        "INSERT INTO entries (fund_id, amount_cents, description) "
        "VALUES (1, 100000, 'opening balance')"
    )


def balance(db: psycopg.Connection, fund: int) -> int:
    (total,) = db.execute(
        "SELECT coalesce(sum(amount_cents), 0)::int FROM entries WHERE fund_id = %s",
        [fund],
    ).fetchone()
    return total


def insert_withdrawal(db: psycopg.Connection, fund: int, amount: int, description: str):
    db.execute(
        "INSERT INTO entries (fund_id, amount_cents, description) VALUES (%s, %s, %s)",
        [fund, -amount, description],
    )


# The right way under READ COMMITTED: lock the fund row before reading the balance.
# Two withdrawals from the same fund then happen one after the other.
def record_withdrawal(
    db: psycopg.Connection, fund: int, amount: int, description: str
) -> bool:
    with db.transaction():
        db.execute("SELECT id FROM funds WHERE id = %s FOR UPDATE", [fund])
        if balance(db, fund) < amount:
            return False
        insert_withdrawal(db, fund, amount, description)
        return True


# 123456 cents → "$1,234.56"; -30000 cents → "-$300.00"
def dollars(cents: int) -> str:
    sign = "-" if cents < 0 else ""
    whole, rest = divmod(abs(cents), 100)
    return f"{sign}${whole:,}.{rest:02d}"
