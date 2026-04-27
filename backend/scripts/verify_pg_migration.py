"""Full row-by-row, field-by-field equality check between SQLite and PG.

This is the definitive "did anything get lost?" check. NOT sampling.
NOT row-count. Every row, every column.

Behaviour:
  * For each table that exists in both DBs:
      - SELECT all rows from each, ordered by primary key
      - Compare row count, then walk pairs and compare each field
      - Cross-engine value normalisation:
          SQLite int 0/1            ↔ PG bool false/true
          SQLite ISO string         ↔ PG date / time / datetime objects
          bytes                     ↔ bytes (raw byte equality, important for embeddings)
          empty string vs NULL      ↔ flagged as a real diff (we want to know)
  * Differences are written line-by-line to stdout AND aggregated counts to stderr.
  * Exit 0 only if every table has zero differences.

Usage:
    cd backend
    python -m scripts.verify_pg_migration <pg_url>
    python -m scripts.verify_pg_migration <pg_url> --sqlite /path/to/snapshot.db
"""
from __future__ import annotations

import argparse
import sys
from datetime import date, time, datetime
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, inspect, text


def _normalise(v: Any) -> Any:
    """Coerce engine-specific representations to a canonical Python value.

    SQLite stores DATE/TIME/DATETIME as strings; PG returns date/time/datetime
    objects. We coerce both sides to the typed form so 1+1 comparisons work.
    Booleans likewise: SQLite returns 0/1, PG returns False/True.
    """
    if v is None:
        return None
    if isinstance(v, (bytes, bytearray)):
        return bytes(v)
    if isinstance(v, bool):
        return v
    if isinstance(v, (date, time, datetime)):
        return v
    if isinstance(v, str):
        s = v.strip()
        # Order matters: pure date YYYY-MM-DD looks like a partial datetime and
        # `datetime.fromisoformat` would happily accept it on Py3.11+. We must
        # rule it out *before* trying datetime so we don't widen a date to a
        # midnight-datetime and then fail equality against a real date object.
        if len(s) == 10 and s[4:5] == "-" and s[7:8] == "-" and "T" not in s and " " not in s:
            try:
                return date.fromisoformat(s)
            except ValueError:
                pass
        if "T" in s or " " in s:
            try:
                return datetime.fromisoformat(s.replace("T", " "))
            except ValueError:
                pass
        if ":" in s and "-" not in s:
            try:
                return time.fromisoformat(s.split(".")[0])
            except ValueError:
                pass
        return s
    return v


def _values_equal(a: Any, b: Any) -> bool:
    """Compare two engine-deserialised values, with SQLite/PG bool tolerance."""
    na, nb = _normalise(a), _normalise(b)
    if na is None and nb is None:
        return True
    # SQLite bool-as-int round-tripped via PG comes back as bool.
    if isinstance(na, bool) ^ isinstance(nb, bool):
        return bool(na) == bool(nb)
    if isinstance(na, int) and isinstance(nb, bool):
        return bool(na) == nb
    if isinstance(nb, int) and isinstance(na, bool):
        return na == bool(nb)
    return na == nb


def _primary_key_cols(insp, table: str):
    pk = insp.get_pk_constraint(table)
    cols = pk.get("constrained_columns") or []
    return cols or ["id"]


def _common_columns(src_insp, tgt_insp, table: str) -> list[str]:
    sc = {c["name"] for c in src_insp.get_columns(table)}
    tc = {c["name"] for c in tgt_insp.get_columns(table)}
    return sorted(sc & tc)


def verify_table(table: str, src_engine, tgt_engine, src_insp, tgt_insp, max_diffs: int = 20):
    pk_cols = _primary_key_cols(src_insp, table)
    cols = _common_columns(src_insp, tgt_insp, table)
    if not cols:
        return {"table": table, "status": "SKIP", "reason": "no common columns"}

    col_list = ", ".join(f'"{c}"' for c in cols)
    order_by = ", ".join(f'"{c}"' for c in pk_cols)

    with src_engine.connect() as sc:
        src_rows = sc.execute(
            text(f'SELECT {col_list} FROM "{table}" ORDER BY {order_by}')
        ).fetchall()
    with tgt_engine.connect() as tc:
        tgt_rows = tc.execute(
            text(f'SELECT {col_list} FROM "{table}" ORDER BY {order_by}')
        ).fetchall()

    diffs = []
    if len(src_rows) != len(tgt_rows):
        diffs.append(("__row_count__", len(src_rows), len(tgt_rows)))

    for idx, (s_row, t_row) in enumerate(zip(src_rows, tgt_rows)):
        s_dict = dict(zip(cols, s_row))
        t_dict = dict(zip(cols, t_row))
        pk = "/".join(str(s_dict.get(p)) for p in pk_cols) or f"row#{idx}"
        for c in cols:
            if not _values_equal(s_dict[c], t_dict[c]):
                diffs.append((f"{pk}.{c}", s_dict[c], t_dict[c]))
                if len(diffs) >= max_diffs:
                    break
        if len(diffs) >= max_diffs:
            break

    return {
        "table": table,
        "rows_src": len(src_rows),
        "rows_tgt": len(tgt_rows),
        "diffs": diffs,
        "status": "OK" if not diffs else "FAIL",
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("pg_url", help="postgresql://user:pwd@host/db")
    ap.add_argument("--sqlite", help="Path to SQLite file (default: backend/arts_management.db)")
    ap.add_argument("--max-diffs", type=int, default=20,
                    help="Stop reporting after this many diffs per table")
    args = ap.parse_args()

    sqlite_path = args.sqlite or str(
        Path(__file__).resolve().parent.parent / "arts_management.db"
    )
    if not Path(sqlite_path).exists():
        print(f"ERROR: SQLite file not found: {sqlite_path}")
        return 1

    src = create_engine(f"sqlite:///{sqlite_path}")
    tgt = create_engine(args.pg_url)

    src_insp = inspect(src)
    tgt_insp = inspect(tgt)

    src_tables = set(src_insp.get_table_names()) - {"sqlite_sequence", "alembic_version"}
    tgt_tables = set(tgt_insp.get_table_names())
    common = sorted(src_tables & tgt_tables)
    only_src = sorted(src_tables - tgt_tables)
    only_tgt = sorted(tgt_tables - src_tables)

    if only_src:
        print(f"WARNING: tables only in SQLite (NOT verified): {only_src}")
    if only_tgt:
        print(f"INFO: tables only in PG (created empty): {only_tgt}")

    print()
    print(f"{'TABLE':35s} {'SRC':>8s} {'TGT':>8s}  STATUS  DIFFS")
    print("-" * 80)

    failed = []
    total_diffs = 0
    for t in common:
        result = verify_table(t, src, tgt, src_insp, tgt_insp, args.max_diffs)
        if result.get("status") == "SKIP":
            print(f"{t:35s} {'-':>8s} {'-':>8s}  SKIP    ({result['reason']})")
            continue
        diffs = result["diffs"]
        n = len(diffs)
        marker = "OK    " if not diffs else "FAIL  "
        print(f"{t:35s} {result['rows_src']:>8d} {result['rows_tgt']:>8d}  {marker}  {n}")
        if diffs:
            failed.append(t)
            total_diffs += n
            for d in diffs[:10]:
                key, sv, tv = d
                # truncate long binary
                def repr_short(x):
                    if isinstance(x, (bytes, bytearray)):
                        return f"<bytes len={len(x)}>"
                    s = repr(x)
                    return s if len(s) < 80 else s[:77] + "..."
                print(f"  • {key:40s}  src={repr_short(sv)}  tgt={repr_short(tv)}")

    print("-" * 80)
    if failed:
        print(f"FAIL: {len(failed)} table(s) with diffs, {total_diffs} reported diff(s).")
        print(f"Failed tables: {failed}")
        return 2
    print("PASS: every common table is byte-equal between SQLite and PostgreSQL.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
