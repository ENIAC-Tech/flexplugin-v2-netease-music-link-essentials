---
name: flexstudio-plugin-developer
description: "Develop or debug FlexStudio v2 plugins using the bundled SDK, manifest, Unit and runtime documentation."
---

# FlexStudio Plugin Developer

Use this skill for FlexStudio v2 plugin work. Keep context focused: load only the references that match the current task.

## Required First Step

Use `references/task-router.md` when choosing documentation for an unfamiliar task. Read only the references relevant to the changed contract.

## Source Of Truth

The bundled docs live in `references/flexdoc/` and are synced from FlexStudioDocumentation. Prefer those docs over memory.

If the task needs source-code confirmation, read `references/source-map.md` to locate the relevant SDK, CLI, host, and template files.

## Operating Rules

- Do not guess manifest fields, Host API names, CLI flags, bridge methods, or Unit definition shapes. Load the relevant reference first.
- Treat `manifest.json`, backend runtime, frontend bridge pages, Unit definitions, and release workflow as one system. Check cross-file contracts when changing any of them.
- Choose validation for the affected contract: validate manifest/schema changes, build changed executable code, and pack when packaging, assets or release behavior is involved.
- Keep generated plugin projects compatible with the template structure unless the user explicitly asks for a custom structure.
- When docs and local code disagree, prefer the local package/API version in the plugin project, then note the mismatch.

- When changing Unit data schema, check `migrateUnit()` and the Unit migration contract before editing code. Missing hooks are no-op; invalid migration results leave existing Unit data unchanged.
## Reference Map

- Task routing: `references/task-router.md`
- Source locations: `references/source-map.md`
- Bundled docs index: `references/docs-index.md`
- Emergency summary: `references/fallback-quick-reference.md`
- Full synced docs: `references/flexdoc/*.md`
