# Connection to PostgreSQL and transactions on behalf of a community or a management
# company.
import psycopg


def connect(url: str) -> psycopg.Connection:
    return psycopg.connect(url, autocommit=True)


# Runs a function in a transaction on behalf of the requester. The "true" in
# set_config makes the value last only for this transaction: on a connection reused
# from a pool, the previous request's community is not left over for the next one.
def _on_behalf_of(db: psycopg.Connection, setting: str, value: int | None, fn):
    with db.transaction():
        if value is not None:
            db.execute("SELECT set_config(%s, %s, true)", [setting, str(value)])
        return fn()


# The board president acts on behalf of one community. The management company acts
# on behalf of every community it manages, which the database policy looks up in the
# managed_communities table.
def as_community(db: psycopg.Connection, community: int | None, fn):
    return _on_behalf_of(db, "app.community", community, fn)


def as_management_company(db: psycopg.Connection, management_company: int, fn):
    return _on_behalf_of(db, "app.management_company", management_company, fn)
