#!/usr/bin/env bash
# Daily PostgreSQL backup for DT-CW.
# Reads password from ~/.pgpass (mode 600), no secrets in this script.
# Crontab line:
#   0 3 * * * /home/ubuntu/DT-CW/scripts/pg-backup.sh >> /home/ubuntu/pg-backups/cron.log 2>&1

set -euo pipefail

BACKUP_DIR="${PG_BACKUP_DIR:-$HOME/pg-backups}"
RETENTION_DAYS="${PG_BACKUP_RETENTION_DAYS:-14}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-dtcw}"
PGDATABASE="${PGDATABASE:-dt_cw}"

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)
OUT="$BACKUP_DIR/dt_cw-$TS.dump"

# -Fc = custom format, gz-compressed, restorable with pg_restore
pg_dump -Fc -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" "$PGDATABASE" > "$OUT"

SIZE=$(stat -c%s "$OUT")
echo "$(date '+%F %T') backup OK: $OUT ($SIZE bytes)"

# Verify the dump is restorable (read-only check)
pg_restore --list "$OUT" >/dev/null
echo "$(date '+%F %T') verify OK: dump is well-formed"

# Rotate
find "$BACKUP_DIR" -maxdepth 1 -name 'dt_cw-*.dump' -mtime +"$RETENTION_DAYS" -delete -print \
  | sed 's/^/rotated: /'
