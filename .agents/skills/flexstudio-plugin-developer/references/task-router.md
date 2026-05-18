# Task Router

Read only the references needed for the current task.

| User task | Load these files |
|---|---|
| Understand the plugin system | `flexdoc/overview.md`, then `source-map.md` if source confirmation is needed |
| Create or reshape a plugin project | `flexdoc/getting-started.md`, `flexdoc/project-structure.md`, `flexdoc/cli-reference.md` |
| Edit `manifest.json` | `flexdoc/manifest.md`, then `flexdoc/marketplace-release.md` if release behavior changes |
| Add or change Unit definitions | `flexdoc/unit-definitions.md`, `flexdoc/backend-runtime.md`, `flexdoc/frontend-bridge.md` |
| Add or change Unit migration/update hooks | `flexdoc/backend-runtime.md`, `flexdoc/unit-definitions.md`, `flexdoc/marketplace-release.md`, `flexdoc/overview.md` |
| Implement backend behavior | `flexdoc/backend-runtime.md`, `flexdoc/host-api-reference.md`, `flexdoc/dependency-api.md` |
| Implement frontend editor/view/config UI | `flexdoc/frontend-bridge.md`, `flexdoc/unit-definitions.md` |
| Use Host API or permissions | `flexdoc/host-api-reference.md`, `flexdoc/manifest.md` |
| Use plugin dependency APIs | `flexdoc/dependency-api.md`, `flexdoc/manifest.md` |
| Debug load/RPC/permission/migration/dev reload failures | `flexdoc/troubleshooting.md`, then the feature-specific docs above |
| Prepare a marketplace release | `flexdoc/marketplace-release.md`, `flexdoc/cli-reference.md`, `flexdoc/manifest.md` |
| Need exact source locations | `source-map.md` |

If a task touches multiple areas, load the union of the relevant files. Avoid loading every reference by default.
