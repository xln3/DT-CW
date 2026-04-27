"""Reset member-user passwords to the last 6 characters of their student_id.

Why:
  Production users were imported with hard-coded defaults like '123456' or
  '202601'. We want each member to log in with the last 6 of their own
  student_id (most teams already remember this; nothing to memorise).

Behaviour:
  * dry-run by default — prints the plan without writing
  * --commit actually writes the new bcrypt hashes
  * --admin-password <pwd> also resets the single admin account
  * users with no member_id, no student_id, or short student_id are SKIPPED
    and reported (your original instruction was: report them, you handle one
    by one)
  * a single AuditLog entry is written summarising the bulk action

Output is intentionally verbose: every skip prints a reason, every plan can be
sampled, and password-collision groups (where many users will share the same
last-6) are listed as INFO (not a security issue, just so you know).

Usage:
    cd backend
    python -m scripts.reset_user_passwords                            # dry-run
    python -m scripts.reset_user_passwords --commit                    # apply
    python -m scripts.reset_user_passwords --commit --admin-password 'xxx'
"""
from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app
from database import db
from models import AuditLog, Member, User


def _build_plan(users):
    plans = []
    skipped = []
    admin_user = None
    for u in users:
        if u.role == User.ROLE_ADMIN:
            admin_user = u
            continue
        if not u.member_id:
            skipped.append((u, "no member_id linked"))
            continue
        member = Member.query.get(u.member_id)
        if not member:
            skipped.append((u, f"member_id={u.member_id} not found"))
            continue
        sid = (member.student_id or "").strip()
        if not sid:
            skipped.append((u, "member has no student_id"))
            continue
        if len(sid) < 6:
            skipped.append((u, f"student_id too short: {sid!r}"))
            continue
        plans.append((u, member, sid, sid[-6:]))
    return plans, skipped, admin_user


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--commit", action="store_true",
                    help="actually write changes (default: dry-run)")
    ap.add_argument("--admin-password",
                    help="if given, also reset the admin user password")
    args = ap.parse_args()

    app = create_app()
    with app.app_context():
        users = User.query.order_by(User.id).all()
        plans, skipped, admin_user = _build_plan(users)

        print("== plan ==")
        print(f"  total users:        {len(users)}")
        print(f"  reset-to-last-6:    {len(plans)}")
        print(f"  skipped:            {len(skipped)}")
        print(f"  admin (separate):   {1 if admin_user else 0}")
        print()

        if skipped:
            print("== skipped users ==")
            for u, reason in skipped:
                print(f"  user#{u.id:>3d}  {u.username!r:25s}  role={u.role:18s}  "
                      f"reason={reason}")
            print()

        # Surface duplicate last-6 groups so you know that e.g. '010917' is
        # shared by several students. Not a security problem — username is the
        # discriminator at login — but worth flagging.
        c = Counter(np for _, _, _, np in plans)
        dups = sorted(((p, n) for p, n in c.items() if n > 1),
                      key=lambda x: -x[1])
        if dups:
            print("== INFO: shared last-6 groups ==")
            for p, n in dups[:10]:
                names = [u.username for u, _, _, np in plans if np == p]
                print(f"  {p!r}: {n} users  ({', '.join(names[:5])}"
                      f"{' ...' if n > 5 else ''})")
            print()

        if not args.commit:
            print("== sample (first 10 of plan) ==")
            for u, m, sid, np in plans[:10]:
                print(f"  {u.username!r:25s}  student_id={sid:12s}  "
                      f"password→ {np}")
            print()
            print("DRY RUN — no changes written. Add --commit to apply.")
            return 0

        for u, _, _, np in plans:
            u.set_password(np)

        admin_done = False
        if args.admin_password:
            if not admin_user:
                print("WARN: --admin-password given but no admin user found")
            else:
                admin_user.set_password(args.admin_password)
                admin_done = True

        db.session.commit()

        AuditLog.log(
            action=AuditLog.ACTION_UPDATE,
            user=None,
            module="auth",
            resource_type="bulk_password_reset",
            details={
                "reset_count": len(plans),
                "skipped_count": len(skipped),
                "skipped_usernames": [u.username for u, _ in skipped],
                "admin_reset": admin_done,
            },
            ip_address=None,
        )

        print(f"COMMITTED: {len(plans)} users reset"
              + (f" + admin {admin_user.username!r}" if admin_done else "")
              + f"; {len(skipped)} skipped (see list above).")
        return 0


if __name__ == "__main__":
    sys.exit(main())
