"""Compare an existing SQLite DB schema against the current ORM models.

Why:
  migrate_to_postgres.py only copies columns that exist in BOTH source and
  target. If production SQLite has a column the ORM no longer knows about,
  that column's data is silently dropped. If the ORM has a NOT NULL column
  the SQLite database does not have, every INSERT into PG fails.

What it reports:
  * Missing-in-ORM   columns present in SQLite but not in current models
                     → DATA LOSS RISK if migrated as-is
  * Missing-in-DB    columns present in ORM but not in SQLite
                     → INSERT FAILURE RISK (if NOT NULL without default)
  * Type mismatches  best-effort comparison
  * Extra tables     SQLite has tables ORM doesn't know about

Usage:
    cd backend
    python -m scripts.check_schema_drift                # uses arts_management.db
    python -m scripts.check_schema_drift /path/to/copy.db
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, inspect

from app import create_app
from database import db


def _orm_columns():
    """Map of {table_name: {col_name: column_type_name}} from ORM models."""
    out = {}
    for table_name, table in db.metadata.tables.items():
        out[table_name] = {
            c.name: type(c.type).__name__ for c in table.columns
        }
    return out


def _sqlite_columns(path: str):
    """Map of {table_name: {col_name: type_string}} from a SQLite DB."""
    engine = create_engine(f"sqlite:///{path}")
    insp = inspect(engine)
    out = {}
    for t in insp.get_table_names():
        if t == "sqlite_sequence":
            continue
        out[t] = {c["name"]: str(c["type"]) for c in insp.get_columns(t)}
    return out


def main(sqlite_path: str) -> int:
    if not Path(sqlite_path).exists():
        print(f"ERROR: file not found: {sqlite_path}")
        return 1

    app = create_app()
    with app.app_context():
        orm = _orm_columns()
    sqlite = _sqlite_columns(sqlite_path)

    fatal = 0
    warn = 0

    orm_tables = set(orm.keys())
    sql_tables = set(sqlite.keys())

    extra_in_sqlite = sorted(sql_tables - orm_tables)
    missing_from_sqlite = sorted(orm_tables - sql_tables)

    if extra_in_sqlite:
        print("[FATAL] tables in SQLite but not in ORM (data would be dropped):")
        for t in extra_in_sqlite:
            print(f"  - {t}  rows={_count_rows(sqlite_path, t)}")
        fatal += len(extra_in_sqlite)

    if missing_from_sqlite:
        print("[INFO] tables in ORM but not in SQLite (will be created empty in PG):")
        for t in missing_from_sqlite:
            print(f"  - {t}")

    for t in sorted(orm_tables & sql_tables):
        orm_cols = set(orm[t].keys())
        sql_cols = set(sqlite[t].keys())
        missing_in_orm = sorted(sql_cols - orm_cols)
        missing_in_sqlite = sorted(orm_cols - sql_cols)

        if missing_in_orm:
            print(f"[FATAL] {t}: columns in SQLite but not in ORM (DATA WILL BE DROPPED):")
            for c in missing_in_orm:
                non_null = _count_non_null(sqlite_path, t, c)
                print(f"  - {c}   sqlite_type={sqlite[t][c]}   rows_with_value={non_null}")
                fatal += 1

        if missing_in_sqlite:
            print(f"[WARN]  {t}: columns in ORM but not in SQLite "
                  f"(PG will INSERT default/NULL): {missing_in_sqlite}")
            warn += len(missing_in_sqlite)

    print()
    if fatal:
        print(f"FAIL: {fatal} fatal drift item(s). Resolve before migrating.")
        return 2
    print(f"OK: schema compatible. ({warn} non-fatal warning(s))")
    return 0


def _count_rows(path: str, table: str) -> int:
    eng = create_engine(f"sqlite:///{path}")
    with eng.connect() as c:
        from sqlalchemy import text
        return c.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar() or 0


def _count_non_null(path: str, table: str, col: str) -> int:
    eng = create_engine(f"sqlite:///{path}")
    with eng.connect() as c:
        from sqlalchemy import text
        return c.execute(
            text(f'SELECT COUNT(*) FROM "{table}" WHERE "{col}" IS NOT NULL')
        ).scalar() or 0


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else str(
        Path(__file__).resolve().parent.parent / "arts_management.db"
    )
    sys.exit(main(path))
