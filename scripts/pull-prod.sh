#!/usr/bin/env bash
# Pull a consistent copy of the production SQLite DB and/or media tree into this checkout.
#
# Download-only. Never writes app data on the server (only a temp snapshot under /tmp).
# Never touches production .env.
#
# Usage:
#   bun run pull:prod
#   bun run pull:prod -- --dry-run
#   bun run pull:prod -- --db-only
#   bun run pull:prod -- --media-only
#   bun run pull:prod -- --delete-media   # rsync --delete (opt-in; removes local-only media)
#
# Overrides (env or flags):
#   SNDBNK_SSH_KEY / --key PATH
#   SNDBNK_SSH_HOST / --host HOST          (default: sndbnk.com)
#   SNDBNK_SSH_USER / --user USER          (default: ubuntu)
#   SNDBNK_REMOTE_ROOT / --remote-root DIR (default: /var/www/sndbnk)
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

KEY="${SNDBNK_SSH_KEY:-$HOME/Documents/Abstractly/LightsailDefaultKey-us-east-1.pem}"
HOST="${SNDBNK_SSH_HOST:-sndbnk.com}"
USER="${SNDBNK_SSH_USER:-ubuntu}"
REMOTE_ROOT="${SNDBNK_REMOTE_ROOT:-/var/www/sndbnk}"

DRY_RUN=0
DO_DB=1
DO_MEDIA=1
DELETE_MEDIA=0
ASSUME_YES=0

die() {
	echo "error: $*" >&2
	exit 1
}

usage() {
	sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
	exit 0
}

while [[ $# -gt 0 ]]; do
	case "$1" in
	--dry-run) DRY_RUN=1 ;;
	--db-only)
		DO_DB=1
		DO_MEDIA=0
		;;
	--media-only)
		DO_DB=0
		DO_MEDIA=1
		;;
	--delete-media) DELETE_MEDIA=1 ;;
	-y | --yes) ASSUME_YES=1 ;;
	--key)
		KEY="${2:-}"
		shift
		;;
	--host)
		HOST="${2:-}"
		shift
		;;
	--user)
		USER="${2:-}"
		shift
		;;
	--remote-root)
		REMOTE_ROOT="${2:-}"
		shift
		;;
	-h | --help) usage ;;
	*) die "unknown flag: $1 (try --help)" ;;
	esac
	shift
done

[[ -n "$KEY" && -n "$HOST" && -n "$USER" && -n "$REMOTE_ROOT" ]] || die "missing SSH/path config"
[[ "$REMOTE_ROOT" == /* ]] || die "remote root must be absolute: $REMOTE_ROOT"
[[ "$DO_DB" -eq 1 || "$DO_MEDIA" -eq 1 ]] || die "nothing to do"

command -v ssh >/dev/null || die "ssh not found"
command -v rsync >/dev/null || die "rsync not found"
command -v scp >/dev/null || die "scp not found"

[[ -f "$KEY" ]] || die "SSH key not found: $KEY"
perm="$(stat -f '%Lp' "$KEY" 2>/dev/null || stat -c '%a' "$KEY")"
[[ "$perm" == "600" || "$perm" == "400" ]] || die "SSH key mode is $perm; chmod 600 \"$KEY\""

load_dotenv_var() {
	local name="$1" file="$2"
	[[ -f "$file" ]] || return 0
	local line
	line="$(grep -E "^${name}=" "$file" | tail -n1 || true)"
	[[ -n "$line" ]] || return 0
	line="${line#*=}"
	line="${line%\"}"
	line="${line#\"}"
	line="${line%\'}"
	line="${line#\'}"
	printf '%s' "$line"
}

LOCAL_DB_REL="$(load_dotenv_var DATABASE_URL .env)"
LOCAL_MEDIA_REL="$(load_dotenv_var MEDIA_ROOT .env)"
LOCAL_DB_REL="${LOCAL_DB_REL:-local.db}"
LOCAL_MEDIA_REL="${LOCAL_MEDIA_REL:-./media}"

case "$LOCAL_DB_REL" in
/var/www/*) die "refusing to write DATABASE_URL under /var/www ($LOCAL_DB_REL)" ;;
esac
case "$LOCAL_MEDIA_REL" in
/var/www/*) die "refusing to write MEDIA_ROOT under /var/www ($LOCAL_MEDIA_REL)" ;;
esac

# Resolve relative to checkout; reject path escape outside ROOT.
resolve_under_root() {
	local rel="$1" label="$2"
	local candidate dir base abs
	if [[ "$rel" == /* ]]; then
		candidate="$rel"
	else
		candidate="$ROOT/${rel#./}"
	fi
	dir="$(dirname "$candidate")"
	base="$(basename "$candidate")"
	[[ -d "$dir" ]] || mkdir -p "$dir"
	abs="$(cd "$dir" && pwd)/$base"
	case "$abs" in
	"$ROOT" | "$ROOT"/*) ;;
	*) die "$label resolves outside checkout: $abs" ;;
	esac
	printf '%s' "$abs"
}

LOCAL_DB="$(resolve_under_root "$LOCAL_DB_REL" DATABASE_URL)"
LOCAL_MEDIA="$(resolve_under_root "$LOCAL_MEDIA_REL" MEDIA_ROOT)"
LOCAL_BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"

SSH_TARGET="${USER}@${HOST}"
SSH_BASE=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15)

remote() {
	"${SSH_BASE[@]}" "$SSH_TARGET" "$@"
}

# Resolve a path declared in the remote .env (DATABASE_URL / MEDIA_ROOT).
# $1 = env var name, $2 = default relative path, $3 = file|dir
remote_resolve_path() {
	local var="$1" default="$2" kind="$3"
	remote "bash -s" -- "$REMOTE_ROOT" "$var" "$default" "$kind" <<'EOS'
set -euo pipefail
root="$1"
var="$2"
default="$3"
kind="$4"
cd "$root"
rel="$default"
if [[ -f .env ]]; then
	line="$(grep -E "^${var}=" .env | tail -n1 || true)"
	if [[ -n "$line" ]]; then
		rel="${line#*=}"
		rel="${rel#\"}"; rel="${rel%\"}"
		rel="${rel#\'}"; rel="${rel%\'}"
	fi
fi
path="$rel"
[[ "$path" == /* ]] || path="$root/${rel#./}"
if [[ "$kind" == file ]]; then
	test -f "$path" || { echo "missing $var file: $path" >&2; exit 1; }
else
	test -d "$path" || { echo "missing $var dir: $path" >&2; exit 1; }
fi
printf '%s\n' "$path"
EOS
}

stamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
remote_tmp="/tmp/sndbnk-pull-${USER}-$$-${stamp}.db"
local_tmp="$(mktemp "${TMPDIR:-/tmp}/sndbnk-pull.XXXXXX.db")"
cleanup() {
	rm -f "$local_tmp"
	# Best-effort: drop remote temp if we created one and bailed mid-transfer.
	if [[ "${REMOTE_TMP_CREATED:-0}" -eq 1 ]]; then
		remote "rm -f $(printf '%q' "$remote_tmp")" 2>/dev/null || true
	fi
}
trap cleanup EXIT

echo "sndbnk pull-prod — download production data into this checkout"
echo
echo "  ssh            $SSH_TARGET"
echo "  key            $KEY"
echo "  remote root    $REMOTE_ROOT"
echo "  local db       $LOCAL_DB"
echo "  local media    $LOCAL_MEDIA"
[[ "$DO_DB" -eq 1 ]] && echo "  db             yes (consistent VACUUM INTO snapshot)"
if [[ "$DO_MEDIA" -eq 1 ]]; then
	if [[ "$DELETE_MEDIA" -eq 1 ]]; then
		echo "  media          yes (rsync pull, --delete)"
	else
		echo "  media          yes (rsync pull, keep local-only files)"
	fi
fi
[[ "$DRY_RUN" -eq 1 ]] && echo "  mode           DRY RUN (no local writes)"
echo

if [[ "$ASSUME_YES" -ne 1 && "$DRY_RUN" -ne 1 ]]; then
	printf 'Type %s to continue: ' "pull"
	read -r answer
	[[ "$answer" == "pull" ]] || die "aborted"
	echo
fi

echo "Checking SSH…"
remote "test -d $(printf '%q' "$REMOTE_ROOT")" || die "remote root missing: $REMOTE_ROOT"
remote 'export PATH="$HOME/.bun/bin:$PATH"; command -v bun >/dev/null' || die "bun not on remote PATH"
remote 'command -v rsync >/dev/null' || die "rsync not on remote"

if [[ "$DO_DB" -eq 1 ]]; then
	echo "Resolving remote DATABASE_URL…"
	remote_db="$(remote_resolve_path DATABASE_URL local.db file)"
	[[ "$remote_db" == /* ]] || die "unexpected remote db path: $remote_db"
	remote "ls -lh $(printf '%q' "$remote_db")"

	if [[ "$DRY_RUN" -eq 1 ]]; then
		echo "  [dry-run] would VACUUM INTO $SSH_TARGET:$remote_tmp → $LOCAL_DB"
	else
		echo "Snapshotting remote SQLite (VACUUM INTO)…"
		remote "bash -s" -- "$remote_db" "$remote_tmp" <<'EOS'
set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"
src="$1"
dest="$2"
rm -f "$dest"
bun --eval '
import { Database } from "bun:sqlite";
const src = process.argv[1];
const dest = process.argv[2];
const db = new Database(src);
db.exec("PRAGMA busy_timeout = 10000");
db.exec("VACUUM INTO " + JSON.stringify(dest));
db.close();
console.log(`snapshot ${src} -> ${dest}`);
' "$src" "$dest"
test -f "$dest"
ls -lh "$dest"
EOS
		REMOTE_TMP_CREATED=1

		echo "Downloading snapshot…"
		scp -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 \
			"${SSH_TARGET}:${remote_tmp}" "$local_tmp"
		remote "rm -f $(printf '%q' "$remote_tmp")"
		REMOTE_TMP_CREATED=0

		mkdir -p "$LOCAL_BACKUP_DIR"
		if [[ -f "$LOCAL_DB" ]]; then
			backup_path="$LOCAL_BACKUP_DIR/$(basename "$LOCAL_DB").pre-pull-$stamp"
			cp -p "$LOCAL_DB" "$backup_path"
			echo "  backed up local db → $backup_path"
			for suffix in -wal -shm -journal; do
				[[ -f "${LOCAL_DB}${suffix}" ]] || continue
				cp -p "${LOCAL_DB}${suffix}" "${backup_path}${suffix}"
			done
		fi

		# Stale WAL/SHM must not pair with the replaced main file.
		rm -f "${LOCAL_DB}-wal" "${LOCAL_DB}-shm" "${LOCAL_DB}-journal"
		mkdir -p "$(dirname "$LOCAL_DB")"
		mv "$local_tmp" "$LOCAL_DB"
		echo "  installed $LOCAL_DB ($(du -h "$LOCAL_DB" | awk '{print $1}'))"
	fi
fi

if [[ "$DO_MEDIA" -eq 1 ]]; then
	echo "Resolving remote MEDIA_ROOT…"
	remote_media="$(remote_resolve_path MEDIA_ROOT ./media dir)"
	[[ "$remote_media" == /* ]] || die "unexpected remote media path: $remote_media"
	remote "du -sh $(printf '%q' "$remote_media")"

	mkdir -p "$LOCAL_MEDIA"
	# Keep flags portable: macOS ships an older rsync without --info=.
	rsync_flags=(-a -h --progress --stats)
	[[ "$DELETE_MEDIA" -eq 1 ]] && rsync_flags+=(--delete)
	[[ "$DRY_RUN" -eq 1 ]] && rsync_flags+=(--dry-run)

	echo "Syncing media…"
	rsync -e "ssh -i $(printf '%q' "$KEY") -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15" \
		"${rsync_flags[@]}" \
		"${SSH_TARGET}:${remote_media}/" \
		"${LOCAL_MEDIA}/"
	echo "  media → $LOCAL_MEDIA"
fi

echo
if [[ "$DRY_RUN" -eq 1 ]]; then
	echo "Dry run finished. Re-run without --dry-run to apply."
else
	echo "Done. Local app will use the pulled DB/media on next bun run dev."
	echo "Tip: if the schema differs, run bun run db:migrate (additive only)."
fi
