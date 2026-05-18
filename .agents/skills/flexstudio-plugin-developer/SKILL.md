---
name: flexstudio-plugin-developer
description: Develop, debug, maintain, and release FlexStudio v2 / FlexDesigner2 plugins using FlexSDK2, FlexCLI plugin-v2, plugin manifest.json, Unit definitions including cycled/slider/value-label/label units, backend runtime, frontend iframe bridge, Host API permissions, dependency APIs, marketplace release workflows, and plugin unit migration/update hooks. Use when working inside a FlexStudio plugin project, creating or modifying plugin code, changing Unit data schema or migration logic, checking SDK or CLI APIs, diagnosing plugin loading/RPC/permission/migration issues, or preparing a plugin release.
---

# FlexStudio Plugin Developer

Use this skill for FlexStudio v2 plugin work. Keep context focused: load only the references that match the current task.

## Required First Step

Read `references/task-router.md` first. It tells you which bundled docs to load for each task type.

## Source Of Truth

The bundled docs live in `references/flexdoc/` and are synced from FlexStudioDocumentation. Prefer those docs over memory.

If the task needs source-code confirmation, read `references/source-map.md` to locate the relevant SDK, CLI, host, and template files.

## Operating Rules

- Do not guess manifest fields, Host API names, CLI flags, bridge methods, or Unit definition shapes. Load the relevant reference first.
- Treat `manifest.json`, backend runtime, frontend bridge pages, Unit definitions, and release workflow as one system. Check cross-file contracts when changing any of them.
- Use `flexcli plugin-v2 validate`, `flexcli plugin-v2 build`, and `flexcli plugin-v2 pack` when verifying plugin changes.
- Keep generated plugin projects compatible with the template structure unless the user explicitly asks for a custom structure.
- When docs and local code disagree, prefer the local package/API version in the plugin project, then note the mismatch.

- When changing Unit data schema, check `migrateUnit()` and the Unit migration contract before editing code. Missing hooks are no-op; invalid migration results leave existing Unit data unchanged.
## Reference Map

- Task routing: `references/task-router.md`
- Source locations: `references/source-map.md`
- Bundled docs index: `references/docs-index.md`
- Emergency summary: `references/fallback-quick-reference.md`
- Full synced docs: `references/flexdoc/*.md`
