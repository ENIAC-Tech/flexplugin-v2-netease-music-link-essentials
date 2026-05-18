# Fallback Quick Reference

Use this only when `references/flexdoc/` is missing or incomplete.

## Plugin Shape

- `manifest.json` declares identity, entries, permissions, platforms, devices, dependencies, and marketplace metadata.
- Backend entry is usually `src/backend/index.ts`; it exports a class extending `FlexPluginBase`.
- Frontend entries are iframe pages mounted through `mountFlexPage`.
- Frontend pages use `useFlexBridge` for Unit data, selected cycled function data, host context, snackbar, Host events, and backend RPC.

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
- Plugin Unit types are `standard`, `custom`, `canvas`, `cycled`, `slider`, `value-label`, and `label`.
- `cycled` reuses the host `cycled-key` architecture. Functions are fixed by the plugin definition; users cannot add/delete/reorder them, but can edit each function appearance through the host editor. Function `data` is edited through the bridge selected-function APIs.
- `slider` reuses the host volume slider architecture. The plugin definition supplies `format`, `min`, `max`, and optional `step`; there is no `decimals` field.
- `value-label` renders runtime numeric text on device using a host-generated atlas. `format` mode accepts finite numbers and ignores `customCharacters`; `custom` mode accepts number/string and allows up to 128 unique declared graphemes.
- `label` renders runtime Unicode text on device using fixed TTF fonts: `puhuiti` or `consola`.
- `appearanceOverride` overlays the host default appearance. For `elements`, an override with `identifier` patches an existing element; an override without `identifier` appends a complete element.
- Runtime cycled state changes must use `hostApi.unit.setFunction(serialNumber, unitUuid, functionId)`.
- Runtime slider state changes must use `hostApi.unit.setSliderValue(serialNumber, unitUuid, value)`.
- Runtime value-label updates must use `hostApi.unit.setValueLabelData(serialNumber, unitUuid, value)`.
- Runtime label updates must use `hostApi.unit.setLabelText(serialNumber, unitUuid, text)`.
- Runtime primary icon updates for `value-label` and `label` must use `hostApi.unit.setUnitIcon(serialNumber, unitUuid, icon)`.
- Slider device changes are delivered through `unit.on(typeId, 'changed')` or `FlexPluginBase.onSliderUnitChanged()`.
- `value-label` and `label` do not add device-originated `changed` events.

- Plugin update migrations use optional backend `migrateUnit(request)`. Missing method means no-op; the host still bumps `unit.plugin.pluginVersion`.
- `migrateUnit()` receives `originalUnit`, `fromVersion`, `toVersion`, `pluginUUID`, `unitId`, `typeId`, and optional `itemId`.
- Return `undefined`/`null` for no-op, `{ data }` to replace only `unit.data`, or `{ unit }` for a complete replacement. Full `unit` results must not change `uuid`, `typeId`, `plugin.pluginUUID`, `plugin.unitId`, or `geometry`.
- Prefer a local dispatch map keyed by `request.unitId` when one plugin owns multiple Unit schemas. Keep migrations idempotent with `unit.data.schemaVersion`.
- Presets own `pluginDependencies`; projects aggregate those snapshots when opening or checking dependencies.
Always prefer the full bundled docs when available.
