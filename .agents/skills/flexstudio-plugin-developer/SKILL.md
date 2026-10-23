---
name: flexstudio-plugin-developer
description: "Develop or debug FlexStudio v2 plugins: native and Composite Units, device layout presets and fallback, device input functions, binding settings, state channels and SDK/host integration, using the bundled architecture and API documentation."
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
- Treat `manifest.json`, backend runtime, frontend bridge pages, Unit definitions, UI/UX guidelines, and release workflow as one system. Check cross-file contracts when changing any of them.
- Declare Unit device presets in `layouts` with a required `default`; exact model presets are independent, and missing/unknown models use `default`. New instances and explicit cross-device Page conversion share this choice; loading a saved Unit does not reset it. Read `references/flexdoc/unit-definitions.md` before changing presets. Do not emit Unit-level `defaultGeometry` or `appearanceOverride`; cycled function overrides remain supported.
- Input functions are separate from Unit definitions: use `defineFunction` and `FlexPluginBase.functions`. Read `references/flexdoc/input-functions.md` for physical input, function settings, feedback or availability work. Do not invent raw device subscriptions or fake Units for functions that need no screen target.
- Keep input state and tool instances isolated by device serial number and binding ID. Use SDK lifecycle/tools for cancellation, serial delivery and stale feedback; no acceleration or long-press repeat is currently supported.
- Use declarative fields for ordinary binding settings. Complex pages use the `input-function-settings` bridge and its session ID, not Unit data, plugin-wide configuration or a raw JSON editor for end users.
- Choose the owner before adding state: Dependency State Channel for a declared dependency, Renderer State Channel for same-plugin UI, input context for binding feedback. Use RPC for one-shot actions. Native panel/chart/label Units use their documented host APIs rather than parallel image or bus protocols.
- When designing plugin UI, load `references/flexdoc/ui-ux-guidelines.md` and follow FlexStudio's Vuetify 3 component, variant, density, color, and layout conventions.
- For Composite Units, read `unit-definitions.md`, `host-api-reference.md` and `backend-runtime.md`. Use `this.compositeElements` for device snapshots, atomic transactions and buffered subscriptions; preserve generation and confirmed state. Use native Button layouts and device font tiers. Carry template images as validated `composite.resources`, never dangling asset IDs or machine paths. Button Groups use one shared native appearance with `presentationVersion: 1`; no per-button appearance.
- Choose validation for the affected contract: validate manifest/schema changes, build changed executable code, and pack when packaging, assets or release behavior is involved.
- Keep generated plugin projects compatible with the template structure unless the user explicitly asks for a custom structure.
- When docs and local code disagree, prefer the local package/API version in the plugin project, then note the mismatch.

- Unit editor writes (`setUnit`, `setUnitData`, `convertUnit`) are normalized and validated by the host; never re-implement identity, `fixedAppearance`, icon or format normalization in the plugin. `setUnitData` replaces `unit.data` as a whole, so merge with the current data. `setUnit` cannot change `uuid`/`typeId`/`plugin`: to change a Unit's definition use `convertUnit({ unitId, data, appearance?, icon? })` with a same-plugin `plugin.unitId`. Always surface the rejection reason. Read `references/flexdoc/frontend-bridge.md` and `troubleshooting.md` for the error codes.
- `visibleInLibrary: false` only hides a definition from the library; it still resolves for existing Units and as a conversion target. A library "placeholder + convert" design is described in `product-plugin-design-guide.md`.
- The host draws button-group indicator lights and the opt-in `cycled` `indicator.onFunctionIds`; the host also owns the common Unit settings group (hold activation, container keep-open). Do not draw selection lines or re-render those switches in plugin UI. For plugin-generated child Units, select the declared preset with SDK `selectUnitDeviceLayoutV1` and `getLayoutContext().deviceModel`; do not infer the model from grid dimensions.
- For a released plugin's Unit schema, check `migrateUnit()` and its contract. A user-authorized development hard cut does not require migration or compatibility code. Do not apply Unit migration hooks to input binding settings.
## Reference Map

- Task routing: `references/task-router.md`
- Source locations: `references/source-map.md`
- Bundled docs index: `references/docs-index.md`
- Emergency summary: `references/fallback-quick-reference.md`
- Full synced docs: `references/flexdoc/*.md`
