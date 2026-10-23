# Source Map

Use this map when bundled docs are not enough or when exact implementation behavior matters.

## Current Plugin Project

- `manifest.json`: plugin identity, permissions, entries, devices, platforms, dependencies.
- `src/backend/index.ts`: backend runtime entry point.
- `src/frontend/*.vue`: Unit editors, Unit view, and config page.
- `src/frontend/main.ts`: `mountFlexPage` entry wiring.
- `.github/workflows/publish.yml`: release automation.

## FlexSDK2

- `packages/types/src/manifest.ts`: manifest types.
- `packages/types/src/plugin-definitions.ts`: Library and Unit definition types, including `PluginUnitLayoutsV1`.
- `packages/types/src/device-layout-selection-v1.ts`: generated exact-model/default selector, exported as `selectUnitDeviceLayoutV1`.
- `packages/types/src/plugin-api.ts`: Host API contracts.
- `packages/types/src/plugin-input.ts`: generated function definitions, raw events, contexts and binding settings contracts.
- `packages/runtime/src/input-function.ts`: defineFunction, lifecycle, availability and per-device/binding serial delivery.
- `packages/runtime/src/input.ts`: gestures, quantize, absolute, feedback and haptic tools.
- `packages/runtime/src/plugin-base.ts`: `FlexPluginBase`.
- `packages/runtime/src/plugin-value-label.ts`: `value-label` format/custom charset and display helpers.
- `packages/runtime/src/plugin-numeric-format.ts`: shared `%f` numeric format parser used by slider and value-label.
- `packages/runtime/src/frontend-bridge.ts`: iframe bridge internals.
- `packages/runtime/src/use-flex-bridge.ts`: Vue-facing bridge composable.
- `packages/runtime/src/mount-flex-page.ts`: frontend page mounting.
- `packages/runtime/src/plugin-i18n.ts`: framework-neutral plugin i18n locale fallback and interpolation helpers.
- `packages/runtime/src/vue-i18n.ts`: Vue `usePluginI18n` adapter.
- `packages/runtime/src/plugin-definitions-validate.ts`: definition validation (including `indicator.onFunctionIds`).
- `packages/types/src/plugin-api.ts`: `convertUnit`, `setUnit`/`setUnitData` write contract, `PluginLayoutContext.deviceModel`.

## Composite Contract Owners

- SDK `packages/types/src/plugin-composite-v1.ts`, `plugin-composite-resources-v1.ts`, `composite-runtime-contract-v1.ts`, `composite-runtime-host-v1.ts`: generated public contracts.
- SDK `packages/runtime/src/composite-element.ts`: buffered subscriptions, structured errors and convenience methods; `FlexPluginBase.compositeElements` owns lifecycle.
- Studio `src/common/element-contracts-v1.ts`: native admission, writable paths and editor capabilities.
- Studio `src/common/plugin-composite-v1.ts`: template defaults, Button configuration and identity remapping.
- Studio `src/common/plugin-composite-resources-v1.ts`: portable resource closure and import through the existing Embedded Theme copy owner.
- Studio `src/main/plugin/composite-template-resources-v1.ts`: trusted raster inspection before library enumeration.
- Studio `src/main/plugin/composite-runtime-bridge.ts`: device routing, correlation and subscriptions; no device-state mirror.
- Studio `src/main/plugin/composite-deployed-button-configs-v1.ts`: private confirmed-deployment config ownership; no editor fallback.
- Workspace `contracts/composite-runtime/v1/`: wire schema, limits and generated TS/C++ snapshots. `contracts/button-element/v1/`: shared native rendering/admission vectors.
- FullTest `src/shared/composite-fixture-v1.json`: tracked Composite AC template and portable PNG resource example.

## FlexCLI

- `src/commands/v2/create.js`: template cloning and parameterization.
- `src/commands/v2/dev.js`: local dev mount, watch, reload, logs.
- `src/commands/v2/build.js`: build assembly.
- `src/commands/v2/pack.js`: `.flexplugin` packaging.
- `src/commands/v2/validate-plugin.js`: manifest and definitions validation.

## FlexStudio Host

- `src/main/plugin/plugin-manager.ts`: lifecycle orchestration and `plugin:migrate-units` IPC.
- `src/main/plugin/process-host.ts`: backend process management.
- `src/main/plugin/api-broker.ts`: Host API dispatch.
- `src/main/plugin/capability-registry.ts`: permission and capability registry.
- `src/types/plugins/plugin-input.ts`: canonical input API contract, synced into SDK/CLI by `script/sync-plugin-contracts.mjs`.
- `src/main/plugin/input-function-bridge.ts`: deployed bindings, generations, reconnect and feedback ownership.
- `src/common/plugin-input-functions.ts`: function catalog adaptation and input-channel filtering.
- `src/common/input-binding-edit-v1.ts`: immutable default/override edits shared by all editors.
- `src/renderer/plugin/input-binding-editor.ts`: settings sessions, project commands and stale-save guards.
- `src/main/plugin/definition-registry.ts`: active definitions (hidden definitions stay resolvable).
- `src/common/device-layout-selection-v1.ts`: canonical exact-model/default selector; synced to SDK.
- `src/common/unit-device-layout-v1.ts`: shared creation and Page conversion layout application.
- `src/common/plugin-unit-template-v1.ts`: plugin type templates and declared layouts.
- `src/common/plugin-unit-authoring-v1.ts`: host-owned normalization/validation of editor writes and Unit conversion.
- `src/renderer/plugin/plugin-bridge.ts`: `set-unit`, `set-unit-data`, `convert-unit` handling and error replies.
- `src/common/unit-indicator.ts`: indicator colors and placement shared by button groups and cycled Units.
- `src/renderer/components/device-panel/flex/common/unit-editor/common/`: the common Unit settings group (`UnitCommonSettings`, `UnitSettingRow`).
- `src/main/plugin/dependency-state-registry.ts`: direct-dependency retained state, replay, ACK queue, resync, rate limits, and Provider lifecycle.
- `src/main/plugin/renderer-state-registry.ts`: same-plugin renderer retained state, replay, ACK queue, resync, payload limits, and session cleanup.
- `src/common/native-text/consumer-contracts.ts`: `value-label` Native Text font-subset requirements.
- `src/main/plugin/capability-registry.ts` (`unit.setValueLabelData`, `unit.setLabelText`, `unit.setUnitIcon`): runtime updates for `value-label` and `label`.
- `src/common/button-group-state.ts`: host-side Button Group normalization, click application, appearance sync, and runtime state helpers.
- `src/functions/button-group/`: built-in Button Group unit definition, editor, view, and device export processing.
- `src/types/plugins/plugin-definitions.ts`: plugin Unit definition shapes, including `PluginButtonGroupDefinition`.
- `src/common/plugin-value-label.ts`: host-side `value-label` format/custom charset and display helpers.
- `src/common/mdi-icon-normalize.ts`: MDI name/codepoint normalization for runtime primary icons.
- `src/main/plugin/asset-protocol.ts`: `plugin-asset://` loading.
- `src/main/plugin/control-ws-server.ts`: CLI dev control WebSocket.
- `src/renderer/plugin/plugin-bridge.ts`: renderer to plugin iframe bridge.
- `src/renderer/plugin/plugin-unit-provider.ts`: active plugin Unit providers.
- `src/types/plugins/migration.ts`: plugin Unit migration request/result contracts.
- `src/common/plugin-unit-migration.ts`: host-side migration result validation and normalization.
- `src/common/plugin-page-dependencies.ts`: page/preset-owned plugin dependency snapshots and project aggregation helpers.
- `src/renderer/composables/usePluginUnitMigration.ts`: renderer project Unit migration orchestration.
- `src/renderer/composables/useProjectPluginDependencyCheck.ts`: project-open missing/update plugin detection and Marketplace navigation.
- `src/preload/index.js`: renderer IPC exposure for plugin migration calls.

## Skill Maintenance

- `flex-plugin-template/.agents/skills/flexstudio-plugin-developer/`: canonical entrypoint and hand-maintained reference routing.
- `flex-plugin-template/scripts/sync-plugin-skill-docs.mjs`: sole sync implementation; `--docs-root` supplies authoritative Markdown, `--target-root` updates a plugin. The Codex plugin wrapper delegates here. These are maintenance inputs, not runtime dependencies.

## Documentation Snapshot

- `.agents/skills/flexstudio-plugin-developer/references/flexdoc/metadata.json`: source commit and sync metadata.
- `.agents/skills/flexstudio-plugin-developer/references/docs-index.md`: generated index for bundled docs.
