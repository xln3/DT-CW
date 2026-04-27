"""Reconcile venue_bookings.status with their linked rehearsal.status.

Historical bug: cancelling or deleting a rehearsal left the corresponding
VenueBooking untouched, because the relationship had no reverse cascade
and SQLite foreign_keys were not enforced. This script:

  1. Reports venue_bookings whose rehearsal_id points to a non-existent
     rehearsal (orphaned rows) and, unless --dry-run, nulls the FK.
  2. For bookings whose rehearsal exists but is CANCELLED while the booking
     is still 'confirmed', flips the booking to 'cancelled'.
  3. Reports a summary — safe to run repeatedly (idempotent).

Usage:
    cd backend
    python -m scripts.fix_rehearsal_venue_consistency [--dry-run]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Allow running as `python -m scripts.fix_rehearsal_venue_consistency`
# or as `python scripts/fix_rehearsal_venue_consistency.py` from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import create_app
from database import db
from models import Rehearsal, VenueBooking


def main(dry_run: bool) -> int:
    app = create_app()
    with app.app_context():
        bookings = VenueBooking.query.all()
        rehearsal_ids = {r.id for r in Rehearsal.query.all()}
        cancelled_rehearsal_ids = {
            r.id for r in Rehearsal.query.filter_by(
                status=Rehearsal.STATUS_CANCELLED
            ).all()
        }

        orphaned = []
        to_cancel = []

        for b in bookings:
            if b.rehearsal_id is None:
                continue
            if b.rehearsal_id not in rehearsal_ids:
                orphaned.append(b)
            elif (
                b.rehearsal_id in cancelled_rehearsal_ids
                and b.status != VenueBooking.STATUS_CANCELLED
            ):
                to_cancel.append(b)

        print(f"total bookings scanned:      {len(bookings)}")
        print(f"  with rehearsal_id:         {sum(1 for b in bookings if b.rehearsal_id)}")
        print(f"  orphaned (FK broken):      {len(orphaned)}")
        print(f"  needing cancel sync:       {len(to_cancel)}")

        if dry_run:
            if orphaned:
                print("\norphaned booking ids:", [b.id for b in orphaned])
            if to_cancel:
                print("\nwill-cancel booking ids:", [b.id for b in to_cancel])
            print("\n--dry-run: no changes made.")
            return 0

        for b in orphaned:
            b.rehearsal_id = None
        for b in to_cancel:
            b.status = VenueBooking.STATUS_CANCELLED
        db.session.commit()

        print(f"\ncommitted: nulled {len(orphaned)} orphaned FKs, "
              f"cancelled {len(to_cancel)} bookings.")
        return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true",
                        help="Report only, don't write.")
    args = parser.parse_args()
    sys.exit(main(args.dry_run))
