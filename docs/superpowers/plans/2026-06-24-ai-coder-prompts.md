# AI-Coder Prompts Implementation Plan

> **For agentic workers:** This plan generates a single markdown deliverable (`docs/improvements-prompts.md`) from the approved design in `docs/superpowers/specs/2026-06-24-ai-coder-prompts-design.md`. Execution is a single document-write task.

**Goal:** Produce a self-contained `docs/improvements-prompts.md` containing 15 full-spec prompts, one per distinct item in `docs/improvements.txt`.

**Architecture:** One markdown file with top-level sections per prompt. Each prompt follows the standard template defined in the design spec: Title, Context, Goal, Acceptance Criteria, Relevant Files/Patterns, Implementation Notes, Testing, Priority/Order.

**Tech Stack:** Markdown only. No code changes.

---

### Task 1: Create `docs/improvements-prompts.md`

**Files:**
- Create: `docs/improvements-prompts.md`

**Steps:**

- [ ] **Step 1: Write the file header**

Add a title and short intro explaining the file's purpose and how to use it.

- [ ] **Step 2: Write Prompt 1 — Add loading + disabled state to "Add" buttons**

Include Context, Goal, Acceptance Criteria, Relevant Files/Patterns, Implementation Notes, Testing, and Priority.

- [ ] **Step 3: Write Prompt 2 — Delete draft and published menus**

Same structure as Step 2.

- [ ] **Step 4: Write Prompt 3 — Bulk menu upload via CSV/Excel modal**

Same structure as Step 2.

- [ ] **Step 5: Write Prompt 4 — Search bar for media upload panel**

Same structure as Step 2.

- [ ] **Step 6: Write Prompt 5 — Cancel/pause subscription via PayFast**

Same structure as Step 2. Reference PayFast recurring-billing docs.

- [ ] **Step 7: Write Prompt 6 — Hide public menus + show fixed notification when subscription invalid**

Same structure as Step 2.

- [ ] **Step 8: Write Prompt 7 — Payment retry link + restrict dashboard when unpaid**

Same structure as Step 2.

- [ ] **Step 9: Write Prompt 8 — Rework team members section / fix invites flow**

Same structure as Step 2.

- [ ] **Step 10: Write Prompt 9 — Allow team members to switch organisations**

Same structure as Step 2.

- [ ] **Step 11: Write Prompt 10 — Team member list: edit permissions, delete, promote**

Same structure as Step 2.

- [ ] **Step 12: Write Prompt 11 — Fix branding save reliability + replace discard icon with delete button**

Same structure as Step 2.

- [ ] **Step 13: Write Prompt 12 — Add undo + obvious publish-to-apply button in branding**

Same structure as Step 2.

- [ ] **Step 14: Write Prompt 13 — Build super-admin editable help/FAQ section**

Same structure as Step 2.

- [ ] **Step 15: Write Prompt 14 — Add back button on public menu about page**

Same structure as Step 2.

- [ ] **Step 16: Write Prompt 15 — Enforce menu hiding when subscription is paused/cancelled**

Same structure as Step 2.

- [ ] **Step 17: Review and commit**

Run a quick scan for placeholders, incomplete sections, or missing prompts. Then commit the file.

```bash
git add docs/improvements-prompts.md
git commit -m "Add AI-coder prompts from improvements.txt"
```
