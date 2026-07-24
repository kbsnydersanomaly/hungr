#!/usr/bin/env bash

set -u -o pipefail
umask 077

# Run fresh OpenCode conversations, one roadmap task each, until checklist
# reports an impasse or a safety limit/failure stops automation.
#
# Usage:
#   bash scripts/roadmap-overnight.sh
#   MAX_SESSIONS=20 MAX_RUNTIME_SECONDS=28800 bash scripts/roadmap-overnight.sh
#
# Safety overrides:
#   MAX_SESSIONS=50          Zero disables session cap.
#   MAX_RUNTIME_SECONDS=43200 Zero disables overall runtime cap.
#   SESSION_TIMEOUT_SECONDS=7200
#   FAILURE_LIMIT=3
#   ALLOW_DIRTY=0            Set 1 only after reviewing startup changes.
#   ALLOW_LOCAL_ENV=0        Set 1 only in an isolated machine/container.
#   ALLOW_ROOT=0             Set 1 only in an isolated container.
#   AUTO_APPROVE=0           Explicit agent allows should suffice; set 1 deliberately.
#   OPENCODE_MODEL=provider/model
#   OPENCODE_VARIANT=high
#   LOG_RETENTION_DAYS=14

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
STATE_FILE="$ROOT_DIR/docs/ROADMAP_STATE.md"
COMMAND_FILE="$ROOT_DIR/.opencode/commands/roadmap-next.md"
AGENT_FILE="$ROOT_DIR/.opencode/agents/roadmap-overnight.md"
STATE_HELPER="$ROOT_DIR/scripts/roadmap-state.mjs"
AUTOMATION_DIR="${ROADMAP_AUTOMATION_DIR:-$ROOT_DIR/.roadmap-automation}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$-$RANDOM"
RUN_DIR="$AUTOMATION_DIR/runs/$RUN_ID"
LOCK_DIR="$ROOT_DIR/.roadmap-automation"
LOCK_FILE="$LOCK_DIR/roadmap-overnight.lock"

SESSION_TIMEOUT_SECONDS="${SESSION_TIMEOUT_SECONDS:-7200}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"
FAILURE_LIMIT="${FAILURE_LIMIT:-3}"
MAX_SESSIONS="${MAX_SESSIONS:-50}"
MAX_RUNTIME_SECONDS="${MAX_RUNTIME_SECONDS:-43200}"
LOG_RETENTION_DAYS="${LOG_RETENTION_DAYS:-14}"
STALL_LIMIT="${STALL_LIMIT:-2}"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"
ALLOW_LOCAL_ENV="${ALLOW_LOCAL_ENV:-0}"
ALLOW_ROOT="${ALLOW_ROOT:-0}"
AUTO_APPROVE="${AUTO_APPROVE:-0}"
OPENCODE_MODEL="${OPENCODE_MODEL:-}"
OPENCODE_VARIANT="${OPENCODE_VARIANT:-}"

session_count=0
consecutive_failures=0
active_pid=""
stop_reason=""
started_epoch="$(date +%s)"
last_progress_key=""
repeated_progress=0

timestamp() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

die() {
  log "ERROR: $*" >&2
  exit 1
}

show_help() {
  sed -n '1,28p' "$0"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

require_nonnegative_integer() {
  local name="$1"
  local value="$2"
  [[ "$value" =~ ^(0|[1-9][0-9]*)$ ]] || die "$name must be a base-10 non-negative integer without leading zeroes, got: $value"
  [[ "$value" -le 2147483647 ]] || die "$name is too large: $value"
}

task_lines() {
  awk '
    /^## Session log/ { exit }
    /^- \[[ x!>~-]\] \*\*[A-Za-z0-9-]+\*\*/ { print }
  ' "$STATE_FILE"
}

validate_state() {
  [[ -r "$STATE_FILE" ]] || return 1
  node "$STATE_HELPER" validate "$STATE_FILE"
}

checklist_signature() {
  task_lines | sha256sum | awk '{print $1}'
}

control_signature() {
  local file
  local files=(
    "$AGENT_FILE"
    "$COMMAND_FILE"
    "$STATE_HELPER"
    "$ROOT_DIR/scripts/roadmap-overnight.sh"
    "$ROOT_DIR/.agents/skills/hungr-roadmap-execution/SKILL.md"
    "$ROOT_DIR/.agents/skills/hungr-project-workflow/SKILL.md"
    "$ROOT_DIR/.agents/skills/hungr-next-ui-work/SKILL.md"
    "$ROOT_DIR/.agents/skills/hungr-supabase-actions/SKILL.md"
    "$ROOT_DIR/.agents/skills/supabase/SKILL.md"
    "$ROOT_DIR/.agents/skills/supabase-postgres-best-practices/SKILL.md"
    "$ROOT_DIR/.claude/skills/hungr-roadmap-execution/SKILL.md"
    "$ROOT_DIR/AGENTS.md"
    "$ROOT_DIR/opencode.json"
    "$ROOT_DIR/opencode.jsonc"
  )
  {
    for file in "${files[@]}"; do
      printf '%s\0' "$file"
      if [[ -f "$file" ]]; then
        sha256sum "$file"
      else
        printf 'MISSING\n'
      fi
    done
  } | sha256sum | awk '{print $1}'
}

repository_signature() {
  {
    git -C "$ROOT_DIR" status --porcelain=v1 --untracked-files=all |
      grep -vE '^.. docs/ROADMAP_STATE\.md$' || true
    git -C "$ROOT_DIR" diff --binary -- . ':(exclude)docs/ROADMAP_STATE.md'
    while IFS= read -r -d '' file; do
      [[ "$file" == "docs/ROADMAP_STATE.md" ]] && continue
      printf '%s\0' "$file"
      sha256sum "$ROOT_DIR/$file"
    done < <(git -C "$ROOT_DIR" ls-files -z --others --exclude-standard)
  } | sha256sum | awk '{print $1}'
}

status_count() {
  local marker="$1"
  task_lines | grep -Ec "^- \\[$marker\\] " || true
}

write_stop_reason() {
  local exit_code="$1"
  mkdir -p "$RUN_DIR"
  {
    printf 'Stopped: %s\n' "$(timestamp)"
    printf 'Reason: %s\n' "$stop_reason"
    printf 'Sessions attempted: %s\n' "$session_count"
    if validate_state; then
      printf 'Checklist status: done=%s partial=%s blocked=%s waiting=%s deferred=%s todo=%s\n' \
        "$(status_count x)" \
        "$(status_count -)" \
        "$(status_count '!')" \
        "$(status_count '>')" \
        "$(status_count '~')" \
        "$(status_count ' ')"
    else
      printf 'Checklist status: INVALID\n'
    fi
    printf 'Logs: %s\n' "$RUN_DIR"
    printf 'Exit code: %s\n' "$exit_code"
  } | tee "$RUN_DIR/STOP_REASON.txt"
}

stop_active_session() {
  if [[ -n "$active_pid" ]] && kill -0 "$active_pid" 2>/dev/null; then
    local process_group
    process_group="$(ps -o pgid= -p "$active_pid" 2>/dev/null | tr -d ' ')"
    if [[ -n "$process_group" && "$process_group" == "$active_pid" ]]; then
      kill -TERM -- "-$process_group" 2>/dev/null || true
    else
      kill -TERM "$active_pid" 2>/dev/null || true
    fi
    for _ in $(seq 1 30); do
      kill -0 "$active_pid" 2>/dev/null || break
      sleep 1
    done
    if kill -0 "$active_pid" 2>/dev/null; then
      if [[ -n "$process_group" && "$process_group" == "$active_pid" ]]; then
        kill -KILL -- "-$process_group" 2>/dev/null || true
      else
        kill -KILL "$active_pid" 2>/dev/null || true
      fi
    fi
    wait "$active_pid" 2>/dev/null || true
  fi
  active_pid=""
}

on_signal() {
  local signal_name="$1"
  local exit_code="$2"
  stop_active_session
  stop_reason="received $signal_name"
  write_stop_reason "$exit_code"
  exit "$exit_code"
}

is_permanent_failure() {
  local command_status="$1"
  local session_stderr="$2"
  local session_log="$3"

  case "$command_status" in
    125|126|127) return 0 ;;
  esac

  node "$STATE_HELPER" permanent-error "$session_log" ||
    grep -Eiq \
      'ConfigInvalidError|invalid config|unknown agent|unknown command|not authenticated|authentication required|no provider' \
      "$session_stderr"
}

retry_delay() {
  local failures="$1"
  local delay
  if [[ "$failures" -ge 7 ]]; then
    delay=300
  else
    delay=$((SLEEP_SECONDS * (2 ** (failures - 1))))
    ((delay > 300)) && delay=300
  fi
  printf '%s' $((delay + RANDOM % 5))
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  show_help
  exit 0
fi
[[ "$#" -eq 0 ]] || die "Unknown argument: $1 (only --help is supported)"

require_nonnegative_integer SESSION_TIMEOUT_SECONDS "$SESSION_TIMEOUT_SECONDS"
require_nonnegative_integer SLEEP_SECONDS "$SLEEP_SECONDS"
require_nonnegative_integer FAILURE_LIMIT "$FAILURE_LIMIT"
require_nonnegative_integer MAX_SESSIONS "$MAX_SESSIONS"
require_nonnegative_integer MAX_RUNTIME_SECONDS "$MAX_RUNTIME_SECONDS"
require_nonnegative_integer LOG_RETENTION_DAYS "$LOG_RETENTION_DAYS"
require_nonnegative_integer STALL_LIMIT "$STALL_LIMIT"
[[ "$SESSION_TIMEOUT_SECONDS" -gt 0 ]] || die "SESSION_TIMEOUT_SECONDS must be greater than zero"
[[ "$FAILURE_LIMIT" -gt 0 ]] || die "FAILURE_LIMIT must be greater than zero"
[[ "$STALL_LIMIT" -gt 0 ]] || die "STALL_LIMIT must be greater than zero"
[[ "$ALLOW_DIRTY" == "0" || "$ALLOW_DIRTY" == "1" ]] || die "ALLOW_DIRTY must be 0 or 1"
[[ "$ALLOW_LOCAL_ENV" == "0" || "$ALLOW_LOCAL_ENV" == "1" ]] || die "ALLOW_LOCAL_ENV must be 0 or 1"
[[ "$ALLOW_ROOT" == "0" || "$ALLOW_ROOT" == "1" ]] || die "ALLOW_ROOT must be 0 or 1"
[[ "$AUTO_APPROVE" == "0" || "$AUTO_APPROVE" == "1" ]] || die "AUTO_APPROVE must be 0 or 1"

require_command opencode
require_command git
require_command node
require_command timeout
require_command flock
require_command awk
require_command sha256sum
require_command tee
require_command grep
require_command sed
require_command sort
require_command uniq
require_command find
require_command ps
require_command seq
require_command tr
require_command cp
require_command cat
require_command realpath

AUTOMATION_DIR="$(realpath -m -- "$AUTOMATION_DIR")"
RUN_DIR="$AUTOMATION_DIR/runs/$RUN_ID"
if [[ "$AUTOMATION_DIR" == "$ROOT_DIR" || ( "$AUTOMATION_DIR" == "$ROOT_DIR/"* && "$AUTOMATION_DIR" != "$LOCK_DIR" ) ]]; then
  die "ROADMAP_AUTOMATION_DIR inside repository must be $LOCK_DIR; use an external directory for custom logs."
fi

[[ -f "$STATE_FILE" ]] || die "Missing roadmap state: $STATE_FILE"
[[ -f "$COMMAND_FILE" ]] || die "Missing OpenCode command: $COMMAND_FILE"
[[ -f "$AGENT_FILE" ]] || die "Missing restricted overnight agent: $AGENT_FILE"
[[ -f "$STATE_HELPER" ]] || die "Missing roadmap state helper: $STATE_HELPER"
git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not a Git worktree: $ROOT_DIR"

if [[ "$(id -u)" -eq 0 && "$ALLOW_ROOT" != "1" ]]; then
  die "Refusing unattended execution as root. Use a dedicated non-root user or set ALLOW_ROOT=1 in an isolated container."
fi

if [[ "$ALLOW_DIRTY" != "1" && -n "$(git -C "$ROOT_DIR" status --porcelain)" ]]; then
  die "Worktree is dirty. Commit/stash reviewed changes first, or deliberately set ALLOW_DIRTY=1."
fi

sensitive_files="$(
  find "$ROOT_DIR" \
    \( -type d \( -name '.git' -o -name 'node_modules' -o -path "$AUTOMATION_DIR" \) \) -prune -o \
    -type f \
    \( -name '.env' -o -name '.env.*' -o -name '.npmrc' -o -name '.netrc' \
       -o -iname '*.pem' -o -iname '*.key' -o -iname '*.p12' -o -iname '*.pfx' \
       -o -name 'id_rsa' -o -name 'id_ed25519' -o -iname '*credentials*.json' \
       -o -iname '*service-account*.json' -o -name 'application_default_credentials.json' \
       -o -path '*/.ssh/*' -o -path '*/.aws/*' -o -path '*/.azure/*' -o -path '*/.config/gcloud/*' \) \
    ! -name '.env.example' -print
)"
if [[ "$ALLOW_LOCAL_ENV" != "1" && -n "$sensitive_files" ]]; then
  die "Sensitive local files found. Use an isolated clone without them, or deliberately set ALLOW_LOCAL_ENV=1: $sensitive_files"
fi

mkdir -p "$AUTOMATION_DIR/runs" "$LOCK_DIR"
find "$AUTOMATION_DIR/runs" -mindepth 1 -maxdepth 1 -type d -mtime "+$LOG_RETENTION_DAYS" -exec rm -rf -- {} +
mkdir "$RUN_DIR" || die "Run directory already exists: $RUN_DIR"

touch "$LOCK_FILE"
exec 9<>"$LOCK_FILE"
if ! flock -n 9; then
  die "Another roadmap automation run holds lock: $LOCK_FILE"
fi
printf 'pid=%s started=%s root=%s\n' "$$" "$(timestamp)" "$ROOT_DIR" >"$LOCK_FILE"

trap 'on_signal INT 130' INT
trap 'on_signal TERM 143' TERM
trap 'on_signal HUP 129' HUP

if ! validate_state; then
  die "Roadmap state failed syntax/uniqueness/status validation: $STATE_FILE"
fi
expected_control_signature="$(control_signature)"

cat >"$RUN_DIR/RUN_CONFIG.txt" <<EOF
started=$(timestamp)
root=$ROOT_DIR
session_timeout_seconds=$SESSION_TIMEOUT_SECONDS
sleep_seconds=$SLEEP_SECONDS
failure_limit=$FAILURE_LIMIT
max_sessions=$MAX_SESSIONS
max_runtime_seconds=$MAX_RUNTIME_SECONDS
allow_dirty=$ALLOW_DIRTY
allow_local_env=$ALLOW_LOCAL_ENV
auto_approve=$AUTO_APPROVE
agent=roadmap-overnight
model=${OPENCODE_MODEL:-default}
variant=${OPENCODE_VARIANT:-default}
stall_limit=$STALL_LIMIT
control_signature=$expected_control_signature
EOF

log "Roadmap automation started"
log "Repository: $ROOT_DIR"
log "Logs (mode 0600): $RUN_DIR"
log "WARNING: run in an isolated clone/user with only required model credentials; logs may contain agent/tool output."
if [[ "$AUTO_APPROVE" == "1" ]]; then
  log "Restricted roadmap-overnight agent will run with --auto; explicit denies remain enforced."
fi

while true; do
  now_epoch="$(date +%s)"
  if [[ "$MAX_RUNTIME_SECONDS" -gt 0 && $((now_epoch - started_epoch)) -ge "$MAX_RUNTIME_SECONDS" ]]; then
    stop_reason="MAX_RUNTIME_SECONDS=$MAX_RUNTIME_SECONDS reached"
    write_stop_reason 2
    exit 2
  fi
  if [[ "$MAX_SESSIONS" -gt 0 && "$session_count" -ge "$MAX_SESSIONS" ]]; then
    stop_reason="MAX_SESSIONS=$MAX_SESSIONS reached"
    write_stop_reason 2
    exit 2
  fi

  validate_state || {
    stop_reason="roadmap state became malformed before next session"
    write_stop_reason 5
    exit 5
  }
  if [[ "$(control_signature)" != "$expected_control_signature" ]]; then
    stop_reason="automation control-plane files changed during run"
    write_stop_reason 5
    exit 5
  fi

  candidate="$(node "$STATE_HELPER" next "$STATE_FILE")" || {
    stop_reason="deterministic roadmap selector failed"
    write_stop_reason 5
    exit 5
  }
  if [[ "$candidate" == "none" ]]; then
    stop_reason="deterministic selector found no unblocked task; complete or waiting/blocked/deferred impasse"
    write_stop_reason 0
    exit 0
  fi

  session_count=$((session_count + 1))
  session_label="$(printf '%04d' "$session_count")"
  session_log="$RUN_DIR/session-$session_label.jsonl"
  session_stderr="$RUN_DIR/session-$session_label.stderr.log"
  session_meta="$RUN_DIR/session-$session_label.meta"
  before_state="$RUN_DIR/session-$session_label.state-before.md"
  cp "$STATE_FILE" "$before_state"
  before_signature="$(checklist_signature)"
  before_done="$(status_count x)"

  args=(
    opencode run
    --command roadmap-next
    --agent roadmap-overnight
    --dir "$ROOT_DIR"
    --format json
    --title "roadmap-next-$RUN_ID-$session_label"
    "$candidate"
  )
  [[ "$AUTO_APPROVE" == "1" ]] && args+=(--auto)
  [[ -n "$OPENCODE_MODEL" ]] && args+=(--model "$OPENCODE_MODEL")
  [[ -n "$OPENCODE_VARIANT" ]] && args+=(--variant "$OPENCODE_VARIANT")

  log "Starting fresh conversation $session_label for $candidate"
  {
    printf 'command='
    printf '%q ' "${args[@]}"
    printf '\nstarted=%s\n\n' "$(timestamp)"
  } >"$session_meta"

  elapsed=$((now_epoch - started_epoch))
  effective_timeout="$SESSION_TIMEOUT_SECONDS"
  if [[ "$MAX_RUNTIME_SECONDS" -gt 0 ]]; then
    remaining_runtime=$((MAX_RUNTIME_SECONDS - elapsed))
    if [[ "$remaining_runtime" -lt "$effective_timeout" ]]; then
      effective_timeout="$remaining_runtime"
    fi
  fi
  [[ "$effective_timeout" -gt 0 ]] || effective_timeout=1

  (
    exec 9>&-
    unset \
      SUPABASE_SERVICE_ROLE_KEY SUPABASE_DB_URL DATABASE_URL \
      PAYFAST_MERCHANT_ID PAYFAST_MERCHANT_KEY PAYFAST_PASSPHRASE \
      VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID \
      GITHUB_TOKEN GH_TOKEN NPM_TOKEN NODE_AUTH_TOKEN \
      AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN \
      GOOGLE_APPLICATION_CREDENTIALS AZURE_CLIENT_SECRET
    exec timeout --signal=TERM --kill-after=30s "$effective_timeout" "${args[@]}"
  ) >"$session_log" 2>"$session_stderr" &
  active_pid="$!"
  wait "$active_pid"
  command_status="$?"
  active_pid=""

  cat "$session_log"
  if [[ -s "$session_stderr" ]]; then
    cat "$session_stderr" >&2
  fi

  validate_state || {
    stop_reason="session $session_label left malformed roadmap state"
    write_stop_reason 5
    exit 5
  }
  if [[ "$(control_signature)" != "$expected_control_signature" ]]; then
    stop_reason="session $session_label modified automation control-plane files"
    write_stop_reason 5
    exit 5
  fi

  after_signature="$(checklist_signature)"
  after_done="$(status_count x)"

  {
    printf '\nfinished=%s\n' "$(timestamp)"
    printf 'command_status=%s\n' "$command_status"
    printf 'checklist_signature_before=%s\n' "$before_signature"
    printf 'checklist_signature_after=%s\n' "$after_signature"
    printf 'done_before=%s\n' "$before_done"
    printf 'done_after=%s\n' "$after_done"
  } >>"$session_meta"

  if [[ "$command_status" -ne 0 ]]; then
    if ! node "$STATE_HELPER" verify-interruption "$before_state" "$STATE_FILE" "$candidate"; then
      stop_reason="failed session $session_label made an unsafe roadmap-state transition"
      write_stop_reason 5
      exit 5
    fi
    consecutive_failures=$((consecutive_failures + 1))
    if is_permanent_failure "$command_status" "$session_stderr" "$session_log"; then
      stop_reason="permanent OpenCode/config/auth failure in session $session_label; exit=$command_status"
      write_stop_reason 3
      exit 3
    fi
    if [[ "$consecutive_failures" -ge "$FAILURE_LIMIT" ]]; then
      stop_reason="OpenCode failed $consecutive_failures consecutive sessions; last exit=$command_status"
      write_stop_reason 3
      exit 3
    fi
    delay="$(retry_delay "$consecutive_failures")"
    if [[ "$MAX_RUNTIME_SECONDS" -gt 0 ]]; then
      now_epoch="$(date +%s)"
      remaining_runtime=$((MAX_RUNTIME_SECONDS - (now_epoch - started_epoch)))
      if [[ "$remaining_runtime" -le 0 ]]; then
        stop_reason="MAX_RUNTIME_SECONDS=$MAX_RUNTIME_SECONDS reached after failed session"
        write_stop_reason 2
        exit 2
      fi
      [[ "$delay" -le "$remaining_runtime" ]] || delay="$remaining_runtime"
    fi
    log "Session $session_label failed (exit $command_status); retrying fresh conversation in ${delay}s ($consecutive_failures/$FAILURE_LIMIT)"
    sleep "$delay"
    continue
  fi

  consecutive_failures=0
  result_output="$(node "$STATE_HELPER" result "$session_log")" || {
    stop_reason="session $session_label omitted/duplicated final assistant ROADMAP_RESULT or emitted invalid JSON events"
    write_stop_reason 5
    exit 5
  }
  IFS=$'\t' read -r ROADMAP_RESULT ROADMAP_TASK <<<"$result_output"
  if ! node "$STATE_HELPER" verify-transition "$before_state" "$STATE_FILE" "$candidate" "$ROADMAP_RESULT" "$ROADMAP_TASK"; then
    stop_reason="session $session_label result/state/log mismatch: selected=$candidate result=$ROADMAP_RESULT task=$ROADMAP_TASK"
    write_stop_reason 5
    exit 5
  fi

  case "$ROADMAP_RESULT" in
    completed|partial|blocked|waiting)
      log "Session $session_label recorded $ROADMAP_RESULT for $ROADMAP_TASK (done $before_done -> $after_done)"
      ;;
    impasse)
      stop_reason="agent reported impasse despite deterministic selection of $candidate"
      write_stop_reason 5
      exit 5
      ;;
    selector_error)
      stop_reason="roadmap selector reported malformed/unsafe state"
      write_stop_reason 5
      exit 5
      ;;
  esac

  progress_key="$ROADMAP_TASK|$ROADMAP_RESULT|$(repository_signature)"
  if [[ "$progress_key" == "$last_progress_key" ]]; then
    repeated_progress=$((repeated_progress + 1))
  else
    repeated_progress=1
    last_progress_key="$progress_key"
  fi
  if [[ "$repeated_progress" -ge "$STALL_LIMIT" ]]; then
    stop_reason="task $ROADMAP_TASK repeated result $ROADMAP_RESULT without repository progress $repeated_progress times"
    write_stop_reason 4
    exit 4
  fi

  success_sleep="$SLEEP_SECONDS"
  if [[ "$MAX_RUNTIME_SECONDS" -gt 0 ]]; then
    now_epoch="$(date +%s)"
    remaining_runtime=$((MAX_RUNTIME_SECONDS - (now_epoch - started_epoch)))
    [[ "$remaining_runtime" -gt 0 ]] || success_sleep=0
    [[ "$success_sleep" -le "$remaining_runtime" ]] || success_sleep="$remaining_runtime"
  fi
  [[ "$success_sleep" -eq 0 ]] || sleep "$success_sleep"
done
