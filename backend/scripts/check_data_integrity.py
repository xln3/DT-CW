"""Scan a SQLite DB for data that PostgreSQL would refuse to insert.

PG enforces foreign keys, NOT NULL, and UNIQUE strictly; SQLite only does so
when foreign_keys pragma is on (we know it isn't on this server). Anything
caught here would either crash migration mid-way or — worse — silently
violate referential integrity once both databases coexist.

Checks performed:
  1. Orphaned foreign keys (referenced row missing)
  2. NOT NULL columns containing NULL
  3. UNIQUE constraint violations (multi-column too)
  4. Date/Time columns containing strings PG can't parse
  5. Boolean columns containing values other than 0/1/NULL
  6. CHECK-style enums in our codebase (status fields) with unknown values

Usage:
    cd backend
    python -m scripts.check_data_integrity [path-to.db]
"""
from __future__ import annotations

import sys
from pathlib import Path
from datetime import date, time, datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, inspect, text

from app import create_app
from database import db


# Fields we know are status enums; values outside the set are suspicious.
KNOWN_ENUMS = {
    ("rehearsals", "status"): {"scheduled", "completed", "cancelled", None},
    ("programs", "status"): {"active", "completed", "cancelled", None},
    ("venue_bookings", "status"): {"confirmed", "cancelled", None},
    ("calendar_events", "status"): {"active", "cancelled", None},
    ("expenses", "status"): {"pending", "approved", "reimbursed", "cancelled", None},
    ("attendance", "status"): {
        "normal", "late", "early_leave", "absent",
        "leave_normal", "leave_late", "leave_early", "leave_absent",
        None,
    },
}


def main(sqlite_path: str) -> int:
    if not Path(sqlite_path).exists():
        print(f"ERROR: file not found: {sqlite_path}")
        return 1

    app = create_app()
    with app.app_context():
        metadata = db.metadata

    eng = create_engine(f"sqlite:///{sqlite_path}")
    insp = inspect(eng)
    sqlite_tables = set(insp.get_table_names())

    fatal = 0
    warn = 0

    with eng.connect() as conn:
        # --- 1. Orphaned foreign keys ---------------------------------------
        print("=== 1. orphaned foreign keys ===")
        for table_name, table in metadata.tables.items():
            if table_name not in sqlite_tables:
                continue
            for fk in table.foreign_keys:
                col = fk.parent.name
                ref_table = fk.column.table.name
                ref_col = fk.column.name
                if ref_table not in sqlite_tables:
                    continue
                q = text(
                    f'SELECT COUNT(*) FROM "{table_name}" t '
                    f'WHERE t."{col}" IS NOT NULL '
                    f'  AND NOT EXISTS '
                    f'    (SELECT 1 FROM "{ref_table}" r WHERE r."{ref_col}" = t."{col}")'
                )
                try:
                    n = conn.execute(q).scalar() or 0
                except Exception as e:
                    print(f"  [skip] {table_name}.{col} -> {ref_table}.{ref_col}: {e}")
                    continue
                if n:
                    print(f"  [FATAL] {table_name}.{col} -> {ref_table}.{ref_col}: "
                          f"{n} orphaned row(s)")
                    fatal += 1

        # --- 2. NOT NULL holding NULL ---------------------------------------
        print("\n=== 2. NOT NULL columns containing NULL ===")
        for table_name, table in metadata.tables.items():
            if table_name not in sqlite_tables:
                continue
            sql_cols = {c["name"]: c for c in insp.get_columns(table_name)}
            for col in table.columns:
                if col.nullable or col.name not in sql_cols:
                    continue
                if col.primary_key:
                    continue
                try:
                    n = conn.execute(text(
                        f'SELECT COUNT(*) FROM "{table_name}" WHERE "{col.name}" IS NULL'
                    )).scalar() or 0
                except Exception:
                    continue
                if n:
                    has_default = col.default is not None or col.server_default is not None
                    tag = "[WARN]" if has_default else "[FATAL]"
                    print(f"  {tag} {table_name}.{col.name}: {n} row(s) NULL "
                          f"(ORM {'has' if has_default else 'no'} default)")
                    if has_default:
                        warn += 1
                    else:
                        fatal += 1

        # --- 3. UNIQUE constraint violations --------------------------------
        print("\n=== 3. UNIQUE violations ===")
        for table_name, table in metadata.tables.items():
            if table_name not in sqlite_tables:
                continue
            uniques = []
            for col in table.columns:
                if col.unique:
                    uniques.append([col.name])
            for con in table.constraints:
                cn = type(con).__name__
                if cn == "UniqueConstraint":
                    uniques.append([c.name for c in con.columns])
            for cols in uniques:
                col_list = ", ".join(f'"{c}"' for c in cols)
                try:
                    rows = conn.execute(text(
                        f'SELECT {col_list}, COUNT(*) c FROM "{table_name}" '
                        f'GROUP BY {col_list} HAVING c > 1'
                    )).fetchall()
                except Exception:
                    continue
                # Skip rows where every key column is NULL (PG treats NULLs as distinct).
                rows = [r for r in rows if not all(v is None for v in r[:-1])]
                if rows:
                    print(f"  [FATAL] {table_name} unique{cols}: {len(rows)} duplicate group(s)")
                    for r in rows[:3]:
                        print(f"    example: {dict(zip(cols, r[:-1]))}  count={r[-1]}")
                    fatal += 1

        # --- 4. Date / time parse-ability -----------------------------------
        print("\n=== 4. date/time fields PG might not parse ===")
        for table_name, table in metadata.tables.items():
            if table_name not in sqlite_tables:
                continue
            for col in table.columns:
                tn = type(col.type).__name__
                if tn not in ("Date", "Time", "DateTime"):
                    continue
                try:
                    vals = conn.execute(text(
                        f'SELECT DISTINCT "{col.name}" FROM "{table_name}" '
                        f'WHERE "{col.name}" IS NOT NULL'
                    )).fetchall()
                except Exception:
                    continue
                bad = []
                for (v,) in vals:
                    if isinstance(v, (date, time, datetime)):
                        continue
                    if not isinstance(v, str):
                        bad.append(v)
                        continue
                    try:
                        if tn == "Date":
                            date.fromisoformat(v)
                        elif tn == "Time":
                            time.fromisoformat(v.split(".")[0])
                        else:
                            datetime.fromisoformat(v.replace("T", " "))
                    except ValueError:
                        bad.append(v)
                if bad:
                    print(f"  [FATAL] {table_name}.{col.name}: {len(bad)} unparseable values")
                    for v in bad[:5]:
                        print(f"    {v!r}")
                    fatal += 1

        # --- 5. Boolean column non-0/1 values -------------------------------
        print("\n=== 5. Boolean columns with non-0/1 values ===")
        for table_name, table in metadata.tables.items():
            if table_name not in sqlite_tables:
                continue
            for col in table.columns:
                if type(col.type).__name__ != "Boolean":
                    continue
                try:
                    vals = conn.execute(text(
                        f'SELECT DISTINCT "{col.name}" FROM "{table_name}"'
                    )).fetchall()
                except Exception:
                    continue
                bad = [v for (v,) in vals if v not in (0, 1, None, True, False)]
                if bad:
                    print(f"  [FATAL] {table_name}.{col.name}: non-bool values {bad}")
                    fatal += 1

        # --- 6. Enum-like status columns ------------------------------------
        print("\n=== 6. status / enum-style columns with unexpected values ===")
        for (table_name, col_name), allowed in KNOWN_ENUMS.items():
            if table_name not in sqlite_tables:
                continue
            try:
                vals = conn.execute(text(
                    f'SELECT DISTINCT "{col_name}" FROM "{table_name}"'
                )).fetchall()
            except Exception:
                continue
            actual = {v for (v,) in vals}
            unexpected = actual - allowed
            if unexpected:
                print(f"  [WARN] {table_name}.{col_name}: unknown {unexpected}")
                warn += 1

    # --- summary -----------------------------------------------------------
    print()
    print(f"summary: fatal={fatal}  warn={warn}")
    if fatal:
        print("FAIL: resolve fatal issues before migrating.")
        return 2
    print("OK: data integrity checks passed.")
    return 0


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else str(
        Path(__file__).resolve().parent.parent / "arts_management.db"
    )
    sys.exit(main(path))
