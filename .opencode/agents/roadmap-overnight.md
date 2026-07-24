---
description: Executes one Hungr roadmap task unattended with repository-scoped, non-deployment permissions
mode: primary
permission:
  "*": deny
  read:
    "*": allow
    "**/.env": deny
    "**/.env.*": deny
    "**/.env.example": allow
    "**/*credentials*.json": deny
    "**/*service-account*.json": deny
    "**/*.pem": deny
    "**/*.key": deny
    "**/*.p12": deny
    "**/*.pfx": deny
    "**/.npmrc": deny
    "**/.netrc": deny
    "**/id_rsa": deny
    "**/id_ed25519": deny
    "**/application_default_credentials.json": deny
    "**/.ssh/**": deny
    "**/.aws/**": deny
    "**/.azure/**": deny
    "**/.config/gcloud/**": deny
  edit:
    "*": allow
    "**/.git/**": deny
    "**/.roadmap-automation/**": deny
    "**/.opencode/**": deny
    "**/.agents/skills/**": deny
    "**/.claude/skills/**": deny
    "opencode.json": deny
    "opencode.jsonc": deny
    "**/opencode.json": deny
    "**/opencode.jsonc": deny
    "**/scripts/roadmap-overnight.sh": deny
    "**/scripts/roadmap-state.mjs": deny
    "**/AGENTS.md": deny
    "**/.env": deny
    "**/.env.*": deny
    "**/.env.example": allow
    "**/*credentials*.json": deny
    "**/*service-account*.json": deny
    "**/*.pem": deny
    "**/*.key": deny
    "**/*.p12": deny
    "**/*.pfx": deny
    "**/.npmrc": deny
    "**/.netrc": deny
    "**/id_rsa": deny
    "**/id_ed25519": deny
    "**/application_default_credentials.json": deny
    "**/.ssh/**": deny
    "**/.aws/**": deny
    "**/.azure/**": deny
    "**/.config/gcloud/**": deny
  glob: allow
  grep: allow
  task: deny
  todowrite: allow
  skill: allow
  webfetch: allow
  websearch: allow
  lsp: allow
  question: deny
  external_directory: deny
  bash:
    "*": deny
    "git status*": allow
    "git diff": allow
    "git log*": allow
    "git show*": allow
    "git ls-files*": allow
    "git rev-parse*": allow
    "git check-ignore*": allow
    "pnpm install*": allow
    "pnpm lint*": allow
    "pnpm test*": allow
    "pnpm build*": allow
    "pnpm e2e*": allow
    "pnpm db:migrate*": allow
    "pnpm db:reset*": allow
    "pnpm db:seed*": allow
    "pnpm db:gen-types*": allow
    "pnpm db:check*": allow
    "pnpm env:which*": allow
    "pnpm exec tsc*": allow
    "pnpm exec eslint*": allow
    "pnpm exec vitest*": allow
    "pnpm exec playwright*": allow
    "pnpm exec supabase start*": allow
    "pnpm exec supabase stop*": allow
    "pnpm exec supabase status*": allow
    "pnpm exec supabase db reset*": allow
    "pnpm exec supabase db diff*": allow
    "pnpm exec supabase migration new*": allow
    "pnpm exec supabase migration up*": allow
    "pnpm exec supabase migration list*": allow
    "pnpm exec supabase gen types*": allow
    "supabase start*": allow
    "supabase stop*": allow
    "supabase status*": allow
    "supabase db reset*": allow
    "supabase db diff*": allow
    "supabase migration new*": allow
    "supabase migration up*": allow
    "supabase migration list*": allow
    "supabase gen types*": allow
    "*--linked*": deny
    "*--db-url*": deny
    "*--project-ref*": deny
    "*--all*": deny
    "*--no-backup*": deny
    "*--no-index*": deny
    "*--output*": deny
    "*--ext-diff*": deny
    "*--textconv*": deny
    "*;*": deny
    "*&&*": deny
    "*||*": deny
    "*|*": deny
    "*>*": deny
    "*<*": deny
    "*$(*": deny
    "*`*": deny
---

Execute exactly one task through `hungr-roadmap-execution`. This is unattended operation.

- Never ask interactive questions. Record required human input as waiting state with exact owner, artifact, and unblock condition.
- Never commit, stage, push, deploy, link remote services, alter Git history, or access credential files.
- Keep all writes inside repository. Preserve unrelated worktree changes.
- Run required local verification when available. Do not fake passing tests or human acceptance.
- End with exact `ROADMAP_RESULT` contract required by `.opencode/commands/roadmap-next.md`.
