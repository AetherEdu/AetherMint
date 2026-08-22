#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# AetherMint - PostgreSQL Backup Script
# =============================================================================
#
# Creates a compressed pg_dump backup, uploads it to S3-compatible cloud
# storage, prunes old backups according to a tiered retention policy, and
# (optionally) verifies the freshest backup by restoring it into a throwaway
# database.
#
# The dump is streamed to disk in PostgreSQL's custom format (-Fc), which is
# itself compressed and never buffers the whole database in memory, so this
# works for arbitrarily large databases.
#
# Usage:
#   scripts/backup-db.sh                 # full run: dump -> upload -> prune
#   scripts/backup-db.sh --verify-only   # restore the latest S3 backup & check
#   scripts/backup-db.sh --no-verify     # skip the post-backup verification
#
# Required environment:
#   DATABASE_URL          postgres://user:pass@host:port/dbname
#   BACKUP_S3_BUCKET      target bucket name (without s3:// prefix)
#
# Optional environment:
#   BACKUP_S3_PREFIX      key prefix inside the bucket   (default: aethermint/db)
#   BACKUP_S3_ENDPOINT    custom endpoint for S3-compatible stores (e.g. MinIO/R2)
#   AWS_REGION            AWS region                     (default: us-east-1)
#   RETAIN_DAILY          daily backups to keep          (default: 7)
#   RETAIN_WEEKLY         weekly backups to keep         (default: 4)
#   RETAIN_MONTHLY        monthly backups to keep        (default: 6)
#   BACKUP_WORKDIR        scratch dir for dump files      (default: mktemp)
#   SLACK_WEBHOOK_URL     if set, a failure alert is POSTed here
#   ALERT_EMAIL_WEBHOOK   if set, a failure alert is POSTed here as JSON
# =============================================================================

SCRIPT_NAME="backup-db"

# --- defaults ----------------------------------------------------------------
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-aethermint/db}"
AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_REGION
RETAIN_DAILY="${RETAIN_DAILY:-7}"
RETAIN_WEEKLY="${RETAIN_WEEKLY:-4}"
RETAIN_MONTHLY="${RETAIN_MONTHLY:-6}"

VERIFY=1
VERIFY_ONLY=0

# --- logging -----------------------------------------------------------------
# Diagnostics go to stderr so a function's stdout can carry data (e.g. an S3
# key) through command substitution without log lines polluting it.
log()  { printf '%s [%s] %s\n'  "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$SCRIPT_NAME" "$*" >&2; }
fail() { printf '%s [%s] ERROR: %s\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" "$SCRIPT_NAME" "$*" >&2; }

# --- aws cli wrapper (supports custom endpoints) -----------------------------
aws_s3() {
  if [[ -n "${BACKUP_S3_ENDPOINT:-}" ]]; then
    aws --endpoint-url "$BACKUP_S3_ENDPOINT" "$@"
  else
    aws "$@"
  fi
}

# --- failure alerting --------------------------------------------------------
send_alert() {
  local message="$1"
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    curl -fsS -X POST -H 'Content-type: application/json' \
      --data "$(printf '{"text":"🔴 AetherMint DB backup failed: %s"}' "$(json_escape "$message")")" \
      "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || fail "failed to deliver Slack alert"
  fi
  if [[ -n "${ALERT_EMAIL_WEBHOOK:-}" ]]; then
    curl -fsS -X POST -H 'Content-type: application/json' \
      --data "$(printf '{"subject":"AetherMint DB backup failed","body":"%s"}' "$(json_escape "$message")")" \
      "$ALERT_EMAIL_WEBHOOK" >/dev/null 2>&1 || fail "failed to deliver email alert"
  fi
}

json_escape() {
  # Minimal JSON string escaping for the alert payloads.
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/ /g' | tr '\n' ' '
}

# --- cleanup -----------------------------------------------------------------
cleanup() {
  if [[ -n "${WORKDIR_IS_TEMP:-}" && -n "${BACKUP_WORKDIR:-}" && -d "$BACKUP_WORKDIR" ]]; then
    rm -rf "$BACKUP_WORKDIR"
  fi
}
trap cleanup EXIT

on_error() {
  local exit_code=$?
  local line=$1
  fail "aborted at line $line (exit $exit_code)"
  send_alert "exited with code $exit_code at line $line on host $(hostname)"
  exit "$exit_code"
}
trap 'on_error $LINENO' ERR

# --- preflight ---------------------------------------------------------------
require_env() {
  local name=$1
  if [[ -z "${!name:-}" ]]; then
    fail "required environment variable $name is not set"
    exit 1
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { fail "required command '$1' not found in PATH"; exit 1; }
}

# --- argument parsing --------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --verify-only) VERIFY_ONLY=1; shift ;;
    --no-verify)   VERIFY=0; shift ;;
    -h|--help)     grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) fail "unknown argument: $1"; exit 1 ;;
  esac
done

require_cmd pg_dump
require_cmd psql
require_cmd aws
require_cmd curl
require_env DATABASE_URL
require_env BACKUP_S3_BUCKET

# Scratch directory for dump files.
if [[ -z "${BACKUP_WORKDIR:-}" ]]; then
  BACKUP_WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/aethermint-backup.XXXXXX")"
  WORKDIR_IS_TEMP=1
fi

s3_uri() { printf 's3://%s/%s' "$BACKUP_S3_BUCKET" "$1"; }

# =============================================================================
# create_backup: stream a compressed dump to disk and upload it to S3.
# Echoes the daily S3 key that was written.
# =============================================================================
create_backup() {
  local stamp dow dom
  stamp="$(date -u +'%Y-%m-%dT%H-%M-%SZ')"
  dow="$(date -u +'%u')"   # 1=Mon .. 7=Sun
  dom="$(date -u +'%d')"   # 01..31

  local filename="aethermint-${stamp}.dump"
  local local_path="$BACKUP_WORKDIR/$filename"

  log "starting pg_dump (custom format, compressed) -> $local_path"
  # -Fc: custom format, internally compressed and restorable with pg_restore.
  # -Z9: max compression. The dump streams to disk; memory use stays flat.
  # --no-owner/--no-privileges keep the dump portable across roles.
  pg_dump --dbname="$DATABASE_URL" \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-privileges \
    --file="$local_path"

  local size
  size="$(wc -c < "$local_path" | tr -d ' ')"
  log "dump complete: $size bytes"

  if [[ "$size" -lt 1 ]]; then
    fail "dump file is empty"
    return 1
  fi

  # Daily copy (always).
  local daily_key="${BACKUP_S3_PREFIX}/daily/${filename}"
  log "uploading -> $(s3_uri "$daily_key")"
  aws_s3 s3 cp "$local_path" "$(s3_uri "$daily_key")" \
    --metadata "db=aethermint,created=${stamp}"

  # Weekly copy on Sundays.
  if [[ "$dow" == "7" ]]; then
    local weekly_key="${BACKUP_S3_PREFIX}/weekly/${filename}"
    log "Sunday detected — copying to $(s3_uri "$weekly_key")"
    aws_s3 s3 cp "$(s3_uri "$daily_key")" "$(s3_uri "$weekly_key")"
  fi

  # Monthly copy on the 1st of the month.
  if [[ "$dom" == "01" ]]; then
    local monthly_key="${BACKUP_S3_PREFIX}/monthly/${filename}"
    log "1st of month detected — copying to $(s3_uri "$monthly_key")"
    aws_s3 s3 cp "$(s3_uri "$daily_key")" "$(s3_uri "$monthly_key")"
  fi

  printf '%s' "$daily_key"
}

# =============================================================================
# prune_tier <tier-prefix> <keep-count>: delete all but the newest <keep-count>
# objects under the given prefix. Keys are sorted lexicographically; the
# ISO-8601 timestamp in each filename makes that equivalent to chronological.
# =============================================================================
prune_tier() {
  local prefix=$1
  local keep=$2

  # List keys (relative to bucket), newest last due to ISO timestamp ordering.
  local keys
  keys="$(aws_s3 s3api list-objects-v2 \
    --bucket "$BACKUP_S3_BUCKET" \
    --prefix "$prefix/" \
    --query 'sort_by(Contents, &Key)[].Key' \
    --output text 2>/dev/null | tr '\t' '\n' | grep -v '^None$' || true)"

  if [[ -z "$keys" ]]; then
    log "prune $prefix: nothing to prune"
    return 0
  fi

  local total
  total="$(printf '%s\n' "$keys" | grep -c . || true)"
  if [[ "$total" -le "$keep" ]]; then
    log "prune $prefix: $total backup(s), keep $keep — nothing to delete"
    return 0
  fi

  local delete_count=$((total - keep))
  log "prune $prefix: $total backup(s), keep $keep — deleting $delete_count old backup(s)"

  printf '%s\n' "$keys" | head -n "$delete_count" | while IFS= read -r key; do
    [[ -z "$key" ]] && continue
    log "  deleting $(s3_uri "$key")"
    aws_s3 s3 rm "$(s3_uri "$key")"
  done
}

apply_retention() {
  log "applying retention policy (daily=$RETAIN_DAILY weekly=$RETAIN_WEEKLY monthly=$RETAIN_MONTHLY)"
  prune_tier "${BACKUP_S3_PREFIX}/daily"   "$RETAIN_DAILY"
  prune_tier "${BACKUP_S3_PREFIX}/weekly"  "$RETAIN_WEEKLY"
  prune_tier "${BACKUP_S3_PREFIX}/monthly" "$RETAIN_MONTHLY"
}

# =============================================================================
# latest_backup_key: echo the newest daily backup key, or empty if none.
# =============================================================================
latest_backup_key() {
  aws_s3 s3api list-objects-v2 \
    --bucket "$BACKUP_S3_BUCKET" \
    --prefix "${BACKUP_S3_PREFIX}/daily/" \
    --query 'sort_by(Contents, &Key)[-1].Key' \
    --output text 2>/dev/null | grep -v '^None$' || true
}

# =============================================================================
# verify_backup: download the latest backup, restore it into a fresh temp
# database, and run sanity checks. The temp database is always dropped.
# =============================================================================
verify_backup() {
  require_cmd pg_restore

  local key
  key="$(latest_backup_key)"
  if [[ -z "$key" ]]; then
    fail "verification requested but no backups found under ${BACKUP_S3_PREFIX}/daily/"
    return 1
  fi

  local local_path="$BACKUP_WORKDIR/verify.dump"
  log "verifying latest backup: $(s3_uri "$key")"
  aws_s3 s3 cp "$(s3_uri "$key")" "$local_path"

  # Derive a server connection string (without the database name) so we can
  # create/drop a scratch database via the 'postgres' maintenance database.
  local base_uri temp_db admin_uri
  base_uri="${DATABASE_URL%/*}"
  temp_db="aethermint_verify_$(date -u +'%Y%m%d%H%M%S')_$$"
  admin_uri="${base_uri}/postgres"

  log "creating temp database '$temp_db' for restore"
  # CREATE DATABASE cannot run inside a transaction; psql autocommits each stmt.
  psql --dbname="$admin_uri" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$temp_db\";"

  # Ensure the temp DB is dropped even if the restore/checks fail.
  local restore_status=0
  {
    log "restoring backup into '$temp_db'"
    # --no-owner/--no-privileges: restore objects under the connecting role.
    # -j: parallel restore for speed on large databases.
    pg_restore --dbname="${base_uri}/${temp_db}" \
      --no-owner --no-privileges --jobs=4 "$local_path"

    log "running sanity checks against '$temp_db'"
    local table_count
    table_count="$(psql --dbname="${base_uri}/${temp_db}" -tAc \
      "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');")"
    log "restored database contains $table_count user table(s)"
    if [[ "${table_count:-0}" -lt 1 ]]; then
      fail "sanity check failed: restored database has no user tables"
      restore_status=1
    fi

    # Connectivity / integrity smoke check.
    psql --dbname="${base_uri}/${temp_db}" -tAc "SELECT 1;" >/dev/null
  } || restore_status=$?

  log "dropping temp database '$temp_db'"
  # Terminate lingering connections so DROP DATABASE cannot be blocked.
  psql --dbname="$admin_uri" -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$temp_db' AND pid <> pg_backend_pid();" \
    >/dev/null 2>&1 || true
  psql --dbname="$admin_uri" -c "DROP DATABASE IF EXISTS \"$temp_db\";" || \
    fail "could not drop temp database '$temp_db' — manual cleanup may be required"

  if [[ "$restore_status" -ne 0 ]]; then
    fail "backup verification failed"
    return 1
  fi
  log "backup verification succeeded"
}

# =============================================================================
# main
# =============================================================================
main() {
  if [[ "$VERIFY_ONLY" -eq 1 ]]; then
    log "running in verify-only mode"
    verify_backup
    log "done"
    return 0
  fi

  log "=== AetherMint database backup starting ==="
  create_backup >/dev/null
  apply_retention

  if [[ "$VERIFY" -eq 1 ]]; then
    verify_backup
  else
    log "verification skipped (--no-verify)"
  fi

  log "=== backup completed successfully ==="
}

main
