<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Roadmap work

For any session working on `HUNGR_PRODUCT_ROADMAP.md` items: start with the `hungr-roadmap-execution` skill (`.agents/skills/` and `.claude/skills/`). It loads `docs/ROADMAP_STATE.md` — the cross-session board of done/required steps — and requires updating it before the session ends.

For an autonomous one-task roadmap session, run `/roadmap-next` or ask to continue the roadmap. Execute exactly one unblocked checklist item, record its final status, then stop.
