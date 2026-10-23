# Fallback Quick Reference

Use this only when `references/flexdoc/` is missing or incomplete.

## Plugin Shape

- `manifest.json` declares identity, entries, permissions, platforms, devices, dependencies, and marketplace metadata.
- Backend entry is usually `src/backend/index.ts`; it exports a class extending `FlexPluginBase`.
- Frontend entries are iframe pages mounted through `mountFlexPage`.
- Frontend pages use `useFlexBridge` for Unit data, selected cycled function/button data, host context, snackbar, Host events, and backend RPC.

## Common Commands

```bash
flexcli plugin-v2 validate --plugin-dir .
flexcli plugin-v2 build --plugin-dir .
flexcli plugin-v2 dev .
flexcli plugin-v2 pack --dist-dir dist
```

## Common Contracts

- `unitFunctionEditor` is the Unit function/data editor iframe.
- `unitAppearanceEditor` is the Unit appearance editor iframe.
- `unitView` is the runtime iframe view for custom Unit UI.
- `configPage` is plugin-level configuration UI.
- Backend RPC methods must be registered by the backend before frontend calls `backendRpc`.
- Host API calls require matching `manifest.permissions`.
- Plugin Unit types are `standard`, `custom`, `canvas`, `cycled`, `slider`, `value-label`, `label`, `button-group`, `panel`, `chart`, and `composite`. Use the full definitions doc for their different native rendering and data APIs.
- `builtinUnits` contributes ordinary host built-in Unit templates. Entries must point to existing host `typeId` values, must not carry `plugin` metadata, and run as normal built-in Units after users add them to a project.
- Editor writes go through the host: `setUnitData` replaces `unit.data` (merge first), `setUnit` cannot change `uuid`/`typeId`/`plugin`, `convertUnit({ unitId, data, appearance?, icon? })` converts to another definition of the same plugin. Rejections carry the reason (`set-unit-error`, `set-unit-data-error`, `convert-unit-error`); value-label/slider formats are validated at edit time. `visibleInLibrary: false` keeps a definition resolvable. Use the exact `getLayoutContext().deviceModel` when selecting presets for plugin-generated children.
- Host-drawn indicator lights: every button-group button; `cycled` opts in with `indicator: { onFunctionIds }` (IDs must exist in `functions`). The host also owns the common Unit settings group; plugins must not re-implement it.
- `cycled` reuses the host `cycled-key` architecture. Functions are fixed by the plugin definition; users cannot add/delete/reorder them, but can edit each function appearance through the host editor. Function `data` is edited through the bridge selected-function APIs.
- `button-group` reuses the host Button Group architecture. Buttons are fixed by the plugin definition; `selectionMode` supports `single` or `multiple`, `mandatory` controls whether at least one button must remain active, and `displayMode`/colors apply across the group. Button business data is edited as selected button `pluginData` through the bridge selected-function APIs.
- `slider` reuses the host volume slider architecture. The plugin definition supplies `format`, `min`, `max`, and optional `step`; there is no `decimals` field.
- `value-label` renders runtime numeric text on device using Native Text font subsets generated from the declared charset. `format` mode accepts finite numbers and ignores `customCharacters`; `custom` mode accepts number/string and allows up to 128 unique declared graphemes.
- `label` renders runtime Unicode text on device using fixed TTF fonts: `puhuiti` or `consola`.
- Every raw Unit definition requires `layouts.default.preferredSize: { width, height }`. `createUnitTemplate()` supplies a 1×1 default when omitted. Optional `layouts.devices[model]` is selected as a whole, with no inheritance from default; unmatched models use default. SDK `selectUnitDeviceLayoutV1` exports the same rule from `@flexsdk/types`.
- Native layout `appearance` patches shared elements by stable `identifier`; new slots need complete elements. Button Group uses layout `buttonGroup` presentation fields, Custom/Canvas uses layout `presentation`, and Panel only declares preferred size. Read `unit-definitions.md` for the complete type-specific contract. Unit-level `defaultGeometry` and `appearanceOverride` are removed; `cycled.functions[].appearanceOverride` remains.
- New instances and explicit cross-device Page conversion select these presets. Conversion retains business content, state and identities and changes matched layout fields; ordinary loading keeps saved layout.
- Runtime cycled state changes must use `hostApi.unit.setFunction(serialNumber, unitUuid, functionId)`.
- Runtime button-group reads/writes must use `hostApi.unit.getButtonGroupState(serialNumber, unitUuid)` and `hostApi.unit.setButtonGroupState(serialNumber, unitUuid, activeButtonIds)`.
- Runtime slider state changes must use `hostApi.unit.setSliderValue(serialNumber, unitUuid, value)`.
- Runtime value-label updates must use `hostApi.unit.setValueLabelData(serialNumber, unitUuid, value)`.
- Runtime label updates must use `hostApi.unit.setLabelText(serialNumber, unitUuid, text)`.
- Runtime primary icon updates for `value-label` and `label` must use `hostApi.unit.setUnitIcon(serialNumber, unitUuid, icon)`.
- Slider device changes are delivered through `unit.on(typeId, 'changed')` or `FlexPluginBase.onSliderUnitChanged()`. Button Group device/API/load changes are delivered through `unit.on(typeId, 'changed')` with `activeButtonIds`, `previousActiveButtonIds`, and button metadata.
- `value-label` and `label` do not add device-originated `changed` events.

- Plugin update migrations use optional backend `migrateUnit(request)`. Missing method means no-op; the host still bumps `unit.plugin.pluginVersion`.
- `migrateUnit()` receives `originalUnit`, `fromVersion`, `toVersion`, `pluginUUID`, `unitId`, `typeId`, and optional `itemId`.
- Return `undefined`/`null` for no-op, `{ data }` to replace only `unit.data`, or `{ unit }` for a complete replacement. Full `unit` results must not change `uuid`, `typeId`, `plugin.pluginUUID`, `plugin.unitId`, or `geometry`.
- Prefer a local dispatch map keyed by `request.unitId` when one plugin owns multiple Unit schemas. Keep migrations idempotent with `unit.data.schemaVersion`.
- Presets own `pluginDependencies`; projects aggregate those snapshots when opening or checking dependencies.
## Input Functions

- Read `flexdoc/input-functions.md` for the current contract. Register `functions = { id: defineFunction(...) }`; the base class collects definitions and routes events. Declare `input`; haptics additionally need `device`.
- Required/optional `rotate`, `press`, `value` channels determine eligible controls; optional target is a same-page Unit typeId. No target means no Unit required.
- Keep state keyed by device serial + binding ID. Use SDK input tools and lifecycle cancellation; offline inputs are not replayed. No acceleration or hold-repeat tools exist.
- `ctx.feedback({ value })` must be normalized to `[0, 1]` (absolute position); the host rejects other values.
- Use `ctx.feedback`, `ctx.haptic` and `function.setAvailable` rather than raw BUS messages.
- Typed fields cover string/number/boolean settings. Complex pages use `input-function-settings`, `getInputBindingContext()` and `setInputBindingSettings(sessionId, settings)`. Preserve the original session across async work; stale saves must fail. Do not write Unit data for binding settings.
- Validate lifecycle cancellation, reconnect, device isolation, settings switching and undo/redo, then build and pack with matching SDK/CLI.

Always prefer the full bundled docs when available.

## Composite and Native Buttons

- Composite is a flat native Button/Text/Icon/Image Unit. Business logic stays in the backend; no custom view, appearance iframe, canvas fallback, Theme replacement or Unit hold mode.
- Button layouts: title-only, icon-only, icon-left, icon-top, none. Modes: key, toggle, cycled. Only key supports longPress/repeat. Toggle/cycled show pending and wait for an actual business confirmation.
- Fonts: builtin:font:puhuiti, builtin:font:consola, builtin:font:ds-digital. Text tiers: 18/20/24/28/32/40/48; icon tiers: 20/24/28/32/40/48. No arbitrary runtime font loading or text shadow.
- Templates carry image resources as `composite.resources: {embeddedTheme, blobBytes}`; use the full docs for the complete package and budgets. Never provide an asset ID without its resource closure.
- Read `this.compositeElements` snapshots and apply atomic transactions. Target comes from load serialNumber/uuid/generation. Operations: create, patch, remove, setState, resetOverrides. Saved structure and current generation stay protected.
- `subscribe` provides a buffered snapshot handshake plus event/offline/retired/error deliveries. Dispose handles; repair gaps with snapshots, never replay clicks. Transaction timeout may mean committed: RESULT_UNKNOWN needs reconciliation.
- `getButtonConfigs` reads private confirmed-deployment metadata, never the editor draft. CACHE_MISS is explicit.
- Button Groups declare presentationVersion: 1 and share background/foreground/font/tier settings. Their layouts omit none; button name/icon/business data remain independent. No per-button appearance override or legacy display values.
