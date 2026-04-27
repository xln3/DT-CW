"""Reset all user passwords via raw SQL UPDATE.

NOTE on history: an earlier ORM version of this script (User.set_password +
db.session.commit() in a loop) silently dropped most rows on commit — only 3
of 144 updates were actually written by Postgres, with no error raised. Root
cause was not pinned down. This script bypasses SQLAlchemy entirely:

  * one psycopg2 connection
  * one transaction
  * one explicit UPDATE per user
  * commit at the end, or rollback on any error
  * post-commit verification by counting fresh updated_at timestamps

Usage:
    python -m scripts.reset_user_passwords                            # dry-run
    python -m scripts.reset_user_passwords --commit
    python -m scripts.reset_user_passwords --commit --admin-password 'xxx'

The DATABASE_URL env var (or --db-url) drives the connection.
"""
from __future__ import annotations

import argparse
import os
import sys
from urllib.parse import urlparse

import bcrypt
import psycopg2


def _parse_db_url(url: str):
    """Convert postgresql://user:pwd@host:port/db to psycopg2 kwargs."""
    p = urlparse(url)
    return dict(
        host=p.hostname or "127.0.0.1",
        port=p.port or 5432,
        user=p.username,
        password=p.password,
        dbname=p.path.lstrip("/"),
    )


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--commit", action="store_true",
                    help="actually write changes (default: dry-run)")
    ap.add_argument("--admin-password",
                    help="if given, also reset the admin user password")
    ap.add_argument("--db-url", default=os.environ.get("DATABASE_URL", ""),
                    help="postgresql://... (or read from DATABASE_URL)")
    args = ap.parse_args()

    if not args.db_url or not args.db_url.startswith("postgresql"):
        print("ERROR: --db-url not given and DATABASE_URL not set or not Postgres")
        return 1

    conn = psycopg2.connect(**_parse_db_url(args.db_url))
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.username, u.role, m.student_id
                  FROM users u
             LEFT JOIN members m ON u.member_id = m.id
              ORDER BY u.id
            """)
            rows = cur.fetchall()

        plans = []        # (user_id, username, new_password)
        skipped = []      # (user_id, username, role, reason)
        admin_user_id = None
        for uid, username, role, sid in rows:
            if role == "admin":
                admin_user_id = (uid, username)
                continue
            sid = (sid or "").strip()
            if not sid:
                skipped.append((uid, username, role, "no student_id"))
                continue
            if len(sid) < 6:
                skipped.append((uid, username, role, f"student_id too short: {sid!r}"))
                continue
            plans.append((uid, username, sid[-6:]))

        print(f"== plan ==")
        print(f"  total users:     {len(rows)}")
        print(f"  reset-to-last-6: {len(plans)}")
        print(f"  skipped:         {len(skipped)}")
        print(f"  admin separate:  {1 if admin_user_id else 0}")
        if skipped:
            print()
            print("== skipped ==")
            for uid, un, role, reason in skipped:
                print(f"  user#{uid}  {un!r:25s}  role={role:18s}  {reason}")
        if not args.commit:
            print()
            print("DRY RUN — add --commit to apply.")
            return 0

        with conn.cursor() as cur:
            for uid, username, np in plans:
                cur.execute(
                    "UPDATE users SET password_hash = %s, updated_at = NOW() "
                    "WHERE id = %s",
                    (_hash(np), uid),
                )
            if args.admin_password and admin_user_id:
                cur.execute(
                    "UPDATE users SET password_hash = %s, updated_at = NOW() "
                    "WHERE id = %s",
                    (_hash(args.admin_password), admin_user_id[0]),
                )
            # audit
            import json
            cur.execute(
                "INSERT INTO audit_logs (action, module, resource_type, details, created_at) "
                "VALUES (%s, %s, %s, %s, NOW())",
                ("update", "auth", "bulk_password_reset",
                 json.dumps({
                     "reset_count": len(plans),
                     "skipped_count": len(skipped),
                     "skipped_usernames": [u for _, u, _, _ in skipped],
                     "admin_reset": bool(args.admin_password),
                     "method": "raw_sql_bypass_orm",
                 }, ensure_ascii=False)),
            )
        conn.commit()
        print(f"\nCOMMITTED via raw SQL: {len(plans)} users"
              + (f" + admin {admin_user_id[1]!r}" if args.admin_password and admin_user_id else "")
              + f"; {len(skipped)} skipped.")

        # Post-commit verification
        with conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM users WHERE updated_at > NOW() - INTERVAL '5 minutes'")
            n = cur.fetchone()[0]
            print(f"verify: {n} rows have updated_at within last 5 minutes")
        return 0
    except Exception as e:
        conn.rollback()
        print(f"ROLLED BACK due to: {e!r}")
        return 2
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
