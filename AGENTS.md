# AGENTS.md for /Users/ylsuen/CF/unapply

## Project scope

Project: 不想考的

This project inherits `/Users/ylsuen/CF/AGENTS.md`.
Read this file and the source/config/tests relevant to the requested change.
Use `PROJECT_STATE.md` for ongoing work and `docs/OPERATIONS.md` for exact
runtime/data/release procedures. Read the matrix for shared-contract or service
boundary changes; search the operations indexes when locating live resources.
Live readback is required when the task depends on current production behavior,
not for an isolated documentation or local text edit.

## Operating constraints

- Canonical local root: `/Users/ylsuen/CF/unapply`.
- Treat unresolved lifecycle, source, runtime, data, and rollback facts as `review_required` and fail closed.
- Preserve unrelated dirty work and active task ownership.
- Do not create parallel identity, Gemini key pools, analytics, registries, or content authority.
- Shared-hub, student-data, App, clone-family, public registration, Cloudflare, VPS, archive, and security gates from the workspace remain mandatory.
- No production mutation follows from a generated inventory or historical report.

## Documentation and handoff gate

Before mutation append a scoped action-log `start`. Record changes and executable verification. Update `docs/OPERATIONS.md` in the same task when an operational fact changes, and update `PROJECT_STATE.md` when current state changes. Closeout must include exact files, artifacts, tests, live version, rollback, dirty-tree state, unresolved items, and documentation updates. Chat is not a handoff authority.
