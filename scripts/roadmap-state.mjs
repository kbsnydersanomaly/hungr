#!/usr/bin/env node

import { readFileSync } from "node:fs";

const TASK_RE = /^- \[([ x!>~-])\] \*\*([A-Za-z0-9-]+)\*\*\s+(.*)$/;
const ID_RE = /\b(?:P\d+B?|D)(?:-[A-Za-z0-9]+)+\b/g;
const RANGE_RE = /((?:P\d+B?|D)(?:-[A-Za-z0-9]+)+)\.\.((?:P\d+B?|D)(?:-[A-Za-z0-9]+)+)/g;
const RESULT_RE = /^ROADMAP_RESULT: (completed|partial|blocked|waiting|impasse|selector_error) TASK: ([A-Za-z0-9-]+|none)$/gm;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseState(path) {
  const content = readFileSync(path, "utf8");
  const headings = content.match(/^## Session log$/gm) ?? [];
  if (headings.length !== 1) fail(`${path}: expected exactly one Session log heading`);

  const splitAt = content.indexOf("## Session log");
  const checklist = content.slice(0, splitAt);
  const sessionLog = content.slice(splitAt);
  const tasks = [];
  const byId = new Map();

  for (const [index, line] of checklist.split(/\r?\n/).entries()) {
    if (!line.startsWith("- [")) continue;
    const match = TASK_RE.exec(line);
    if (!match) {
      fail(`${path}:${index + 1}: malformed checklist row`);
    }
    const [, marker, id, description] = match;
    if (byId.has(id)) fail(`${path}:${index + 1}: duplicate task ID ${id}`);
    if (marker === "-" && !/Progress:\s*\S/.test(description)) fail(`${path}:${index + 1}: partial task lacks Progress`);
    if (marker === "!" && !/Blocked by:\s*\S/.test(description)) fail(`${path}:${index + 1}: blocked task lacks Blocked by`);
    if (marker === ">" && !/Awaiting:\s*\S/.test(description)) fail(`${path}:${index + 1}: waiting task lacks Awaiting`);
    const task = { id, marker, description, line, lineNumber: index, index: tasks.length, dependencies: [] };
    tasks.push(task);
    byId.set(id, task);
  }
  if (tasks.length === 0) fail(`${path}: no checklist tasks found`);

  for (const task of tasks) {
    const hasDependencyClause = task.description.includes("Depends on:");
    const dependencyText = hasDependencyClause
      ? task.description.slice(task.description.indexOf("Depends on:") + "Depends on:".length)
      : "";
    if (hasDependencyClause && !dependencyText.trim()) fail(`${path}: empty dependency clause on ${task.id}`);
    if (dependencyText) {
      const grammarRemainder = dependencyText
        .replace(RANGE_RE, "")
        .replace(ID_RE, "")
        .replace(/[\s,.]/g, "");
      if (grammarRemainder) fail(`${path}: invalid dependency grammar on ${task.id}: ${dependencyText.trim()}`);
    }
    const dependencies = new Set();
    for (const range of dependencyText.matchAll(RANGE_RE)) {
      const start = byId.get(range[1]);
      const end = byId.get(range[2]);
      if (!start || !end || start.index > end.index) fail(`${path}: invalid dependency range ${range[0]} on ${task.id}`);
      for (let i = start.index; i <= end.index; i += 1) dependencies.add(tasks[i].id);
    }
    for (const id of dependencyText.match(ID_RE) ?? []) dependencies.add(id);
    if (dependencies.has(task.id)) fail(`${path}: ${task.id} depends on itself`);
    for (const id of dependencies) {
      if (!byId.has(id)) fail(`${path}: ${task.id} depends on missing ${id}`);
    }
    task.dependencies = [...dependencies];
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(id, chain = []) {
    if (visiting.has(id)) fail(`${path}: dependency cycle: ${[...chain, id].join(" -> ")}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id).dependencies) visit(dependency, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const task of tasks) visit(task.id);

  return { content, checklist, sessionLog, tasks, byId };
}

function dependenciesComplete(state, task) {
  return task.dependencies.every((id) => state.byId.get(id)?.marker === "x");
}

function nextTask(state) {
  const partial = state.tasks.find((task) => task.marker === "-" && dependenciesComplete(state, task));
  if (partial) return partial.id;
  return state.tasks.find((task) => task.marker === " " && dependenciesComplete(state, task))?.id ?? "none";
}

function assistantResult(path) {
  const texts = [];
  for (const [index, line] of readFileSync(path, "utf8").split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      fail(`${path}:${index + 1}: invalid OpenCode JSON event`);
    }
    if (event.type === "text" && event.part?.type === "text" && typeof event.part.text === "string") {
      texts.push(event.part.text);
    }
  }
  if (texts.length === 0) fail(`${path}: no completed assistant text event found`);
  const finalText = texts.at(-1).trimEnd();
  const finalLine = finalText.split(/\r?\n/).at(-1);
  const matches = [...finalLine.matchAll(RESULT_RE)];
  if (matches.length !== 1 || matches[0][0] !== finalLine) {
    fail(`${path}: final assistant text must end with exactly one ROADMAP_RESULT line`);
  }
  process.stdout.write(`${matches[0][1]}\t${matches[0][2]}\n`);
}

function hasPermanentError(path) {
  const pattern = /ConfigInvalidError|invalid config|unknown agent|unknown command|not authenticated|authentication required|no provider/i;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "error" && pattern.test(JSON.stringify(event))) process.exit(0);
    } catch {
      // Failed sessions may end with a truncated event; stderr remains the fallback.
    }
  }
  process.exit(1);
}

function verifyTransition(beforePath, afterPath, expectedTask, result, resultTask) {
  const before = parseState(beforePath);
  const after = parseState(afterPath);
  if (resultTask !== expectedTask) fail(`result task ${resultTask} does not match selected ${expectedTask}`);
  if (["impasse", "selector_error"].includes(result)) fail(`${result} invalid after runner selected ${expectedTask}`);

  const beforeTask = before.byId.get(expectedTask);
  const afterTask = after.byId.get(expectedTask);
  if (!beforeTask || !afterTask) fail(`selected task ${expectedTask} missing before or after session`);
  if (beforeTask.line === afterTask.line) fail(`selected task ${expectedTask} did not change`);

  const nonTaskLines = (state) => state.checklist
    .split(/\r?\n/)
    .filter((line) => !TASK_RE.test(line))
    .join("\n");
  if (nonTaskLines(before) !== nonTaskLines(after)) fail("session changed non-task checklist content");

  const expectedMarker = { completed: "x", partial: "-", blocked: "!", waiting: ">" }[result];
  if (!expectedMarker || afterTask.marker !== expectedMarker) {
    fail(`result ${result} requires ${expectedTask} marker ${expectedMarker}, found ${afterTask.marker}`);
  }

  for (const task of before.tasks) {
    if (task.id === expectedTask) continue;
    const next = after.byId.get(task.id);
    if (!next) fail(`session removed existing task ${task.id}`);
    if (task.line !== next.line) fail(`session changed non-selected task ${task.id}`);
  }
  const afterExistingOrder = after.tasks.filter((task) => before.byId.has(task.id)).map((task) => task.id);
  const beforeOrder = before.tasks.map((task) => task.id);
  if (afterExistingOrder.join("\n") !== beforeOrder.join("\n")) fail("session reordered existing checklist tasks");

  const newTaskIds = [];
  for (const task of after.tasks) {
    if (!before.byId.has(task.id)) {
      if (task.marker !== " ") fail(`newly discovered task ${task.id} must start [ ]`);
      newTaskIds.push(task.id);
    }
  }

  if (!after.sessionLog.startsWith(before.sessionLog)) fail("session log history was rewritten instead of appended");
  const beforeRows = before.sessionLog.split(/\r?\n/).filter((line) => /^\| 20\d\d-\d\d-\d\d \|/.test(line)).length;
  const afterLogRows = after.sessionLog.split(/\r?\n/).filter((line) => /^\| 20\d\d-\d\d-\d\d \|/.test(line));
  const afterRows = afterLogRows.length;
  if (afterRows !== beforeRows + 1) fail(`session log must append exactly one row; before=${beforeRows} after=${afterRows}`);
  const appendedRow = afterLogRows.at(-1);
  const columns = appendedRow.split("|").map((part) => part.trim());
  const hasToken = (text, token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Za-z0-9-])${escaped}([^A-Za-z0-9-]|$)`).test(text);
  };
  if (!hasToken(columns[2] ?? "", expectedTask) || !hasToken(columns[2] ?? "", result)) {
    fail(`appended session row must name ${expectedTask} and result ${result}`);
  }
  if (columns.length < 6 || !columns[3]) fail("appended session row must record verification actually run");
  for (const id of newTaskIds) {
    if (!hasToken(columns[2] ?? "", id)) fail(`appended session row must name newly discovered task ${id}`);
  }
}

function verifyInterruption(beforePath, afterPath, expectedTask) {
  const beforeContent = readFileSync(beforePath, "utf8");
  const afterContent = readFileSync(afterPath, "utf8");
  if (beforeContent === afterContent) return;
  const before = parseState(beforePath);
  const after = parseState(afterPath);
  const beforeTask = before.byId.get(expectedTask);
  const afterTask = after.byId.get(expectedTask);
  if (!beforeTask || !afterTask) fail(`selected task ${expectedTask} missing before or after interrupted session`);
  const beforeLines = before.checklist.split(/\r?\n/);
  const afterLines = after.checklist.split(/\r?\n/);
  if (beforeLines.length !== afterLines.length || beforeTask.lineNumber !== afterTask.lineNumber) {
    fail("interrupted session changed checklist structure");
  }
  for (let index = 0; index < beforeLines.length; index += 1) {
    if (index !== beforeTask.lineNumber && beforeLines[index] !== afterLines[index]) {
      fail(`interrupted session changed checklist content outside ${expectedTask}`);
    }
  }
  verifyTransition(beforePath, afterPath, expectedTask, "partial", expectedTask);
}

const [command, ...args] = process.argv.slice(2);
if (command === "validate" && args.length === 1) {
  parseState(args[0]);
} else if (command === "next" && args.length === 1) {
  process.stdout.write(`${nextTask(parseState(args[0]))}\n`);
} else if (command === "result" && args.length === 1) {
  assistantResult(args[0]);
} else if (command === "permanent-error" && args.length === 1) {
  hasPermanentError(args[0]);
} else if (command === "verify-transition" && args.length === 5) {
  verifyTransition(args[0], args[1], args[2], args[3], args[4]);
} else if (command === "verify-interruption" && args.length === 3) {
  verifyInterruption(args[0], args[1], args[2]);
} else {
  fail("Usage: roadmap-state.mjs validate STATE | next STATE | result JSONL | permanent-error JSONL | verify-transition BEFORE AFTER EXPECTED RESULT RESULT_TASK | verify-interruption BEFORE AFTER EXPECTED");
}
