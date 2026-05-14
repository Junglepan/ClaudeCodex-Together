# AGENTS.md instructions for /Users/panbk/Programmer/ClaudeCodex-Together

## Default Engineering Workflow (Mandatory)

For feature work, bugfixes, and refactors, follow this order unless the user explicitly overrides:

1. Use `brainstorming` to clarify goals, constraints, non-goals, assumptions, trade-offs, and acceptance criteria.
2. Use `writing-plans` to produce step-by-step implementation tasks with file paths and verification steps.
3. Implement via `test-driven-development` using RED -> GREEN -> REFACTOR.
4. If failures or unexpected behavior occur, use `systematic-debugging` before proposing fixes.
5. Before claiming completion, run `verification-before-completion` with concrete command/test evidence.
6. When work is done, use `finishing-a-development-branch` for merge/PR/cleanup decisions.

Additional rules:

- No quick fixes without root-cause analysis for bugs.
- No completion claims without verification output.
- Keep changes minimal and aligned to the accepted plan.

## Karpathy-Inspired Agent Behavior

These rules are adapted from the Karpathy-inspired Claude Code guidelines and apply to Codex agents working in this repository.

### 1. Think Before Coding

Do not assume. Do not hide confusion. Surface trade-offs before changing files.

- State assumptions explicitly when they affect the implementation.
- If the request has multiple plausible interpretations, present the options instead of silently choosing one.
- Push back when a simpler or safer approach exists.
- If something is unclear enough to change the outcome, stop and ask for clarification.

### 2. Simplicity First

Use the minimum code and configuration needed to solve the requested problem.

- Do not add features beyond what was asked.
- Do not create abstractions for one-off behavior.
- Do not add flexibility, configuration, or extension points that were not requested.
- Do not add defensive handling for impossible scenarios.
- If a solution becomes noticeably larger than the problem requires, simplify it before proceeding.

Check: would a senior engineer call this overcomplicated? If yes, reduce the scope or implementation.

### 3. Surgical Changes

Touch only what the request requires. Clean up only the mess created by the current change.

- Do not improve adjacent code, comments, or formatting just because you noticed them.
- Do not refactor unrelated code.
- Match the existing style of the file or module being edited.
- If unrelated dead code or risk is found, mention it instead of deleting or rewriting it.
- Remove imports, variables, functions, files, or config entries only when this change made them unused.

Check: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Turn tasks into verifiable success criteria and loop until those criteria are met.

- For validation work, write tests for invalid inputs and make them pass.
- For bugfixes, write or run a reproduction first, then make it pass.
- For refactors, verify behavior before and after the change.
- For multi-step work, state a short plan where each step has a concrete verification check.

Strong success criteria are required before independent execution. Avoid vague goals such as "make it work" unless they have been converted into observable checks.

### 5. Keep Agent Loops Deterministic

Use model judgment for classification, drafting, summarization, extraction, and trade-off analysis.

- Do not use model judgment for routing, retries, status-code handling, deterministic transforms, or other logic code can decide.
- If code can answer, code answers.

### 6. Read Before Writing

Before adding code, read the nearby exports, immediate callers, and shared utilities.

- If two existing patterns conflict, choose one based on recency, test coverage, and local fit.
- Explain the choice briefly when it affects the implementation.
- Do not blend conflicting patterns.

### 7. Tests Verify Intent

Tests should prove the intended contract, not only that a value was returned.

- Name tests around the behavior or risk they protect.
- Include failure cases when they define the feature's purpose.
- A test that would still pass after replacing the logic with a constant is not useful.

### 8. Fail Loud

Surface skipped work, partial failures, uncertainty, warnings, and uncovered verification.

- Do not call work complete if anything was skipped silently.
- Do not call tests passing if any tests were skipped or only partially run.
- When context gets long or the state is hard to summarize, stop and restate what is known before continuing.

## Project-Specific Guidance

- This project is a local Claude Code / Codex CLI configuration manager. Preserve the distinction between Claude files (`CLAUDE.md`, `.claude/`) and Codex files (`AGENTS.md`, `.codex/`).
- Treat user configuration files as sensitive local state. Avoid destructive edits, and preserve unrelated content.
- Prefer existing Electron IPC backend patterns in `electron/backend/` and existing UI patterns in `src/modules/`.
- For frontend changes, follow the established React + TypeScript + Tailwind conventions and keep operational UI dense, readable, and task-focused.
