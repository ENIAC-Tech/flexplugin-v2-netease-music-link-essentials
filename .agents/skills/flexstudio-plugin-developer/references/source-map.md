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
- `packages/types/src/plugin-definitions.ts`: Library and Unit definition types.
- `packages/types/src/plugin-api.ts`: Host API contracts.
- `packages/runtime/src/plugin-base.ts`: `FlexPluginBase`.
- `packages/runtime/src/plugin-value-label.ts`: `value-label` format/custom charset and display helpers.
- `packages/runtime/src/plugin-numeric-format.ts`: shared `%f` numeric format parser used by slider and value-label.
- `packages/runtime/src/frontend-bridge.ts`: iframe bridge internals.
- `packages/runtime/src/use-flex-bridge.ts`: Vue-facing bridge composable.
- `packages/runtime/src/mount-flex-page.ts`: frontend page mounting.
- `packages/runtime/src/plugin-definitions-validate.ts`: definition validation.

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
- `src/main/plugin/definition-registry.ts`: active definitions.
- `src/main/plugin/plugin-value-label-atlas.ts`: `value-label` atlas generation and extended-data reconciliation.
- `src/main/plugin/plugin-runtime-label-device-data.ts`: device export metadata for `value-label` and `label`.
- `src/common/plugin-value-label.ts`: host-side `value-label` format/custom charset and display helpers.
- `src/common/mdi-icon-normalize.ts`: MDI name/codepoint normalization for runtime primary icons.
- `src/main/plugin/asset-protocol.ts`: `plugin-asset://` loading.
- `src/main/plugin/control-ws-server.ts`: CLI dev control WebSocket.
- `src/renderer/plugin/plugin-bridge.ts`: renderer to plugin iframe bridge.
- `src/renderer/plugin/plugin-unit-provider.ts`: active plugin Unit providers.
- `src/types/plugins/migration.ts`: plugin Unit migration request/result contracts.
- `src/common/plugin-unit-migration.ts`: host-side migration result validation and normalization.
- `src/common/plugin-preset-dependencies.ts`: preset-owned plugin dependency snapshots and project aggregation helpers.
- `src/renderer/composables/usePluginUnitMigration.ts`: renderer project Unit migration orchestration.
- `src/renderer/composables/useProjectPluginDependencyCheck.ts`: project-open missing/update plugin detection and Marketplace navigation.
- `src/preload/index.js`: renderer IPC exposure for plugin migration calls.

## Documentation Snapshot

- `.agents/skills/flexstudio-plugin-developer/references/flexdoc/metadata.json`: source commit and sync metadata.
- `.agents/skills/flexstudio-plugin-developer/references/docs-index.md`: generated index for bundled docs.
