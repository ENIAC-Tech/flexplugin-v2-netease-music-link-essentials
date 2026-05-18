# 快速开始

本页介绍从零创建一个插件、在 FlexStudio 中运行、热重载调试并打包的最短路径。

## 前置条件

需要准备：

- Node.js 与 npm。
- FlexStudio 本地开发版或已安装版本。
- `@eniac/flexcli`。
- 一个可提交到 GitHub 的插件仓库，发布到市场时需要。

安装 CLI：

```bash
npm install -g @eniac/flexcli
```

检查 CLI 是否可用：

```bash
flexcli --help
```

## 创建插件项目

使用 CLI 创建插件：

```bash
flexcli plugin create
```

## 使用内置 Agent Skill

v2 插件模板会随项目生成一个本地 agent skill：

```text
.agents/skills/flexstudio-plugin-developer/SKILL.md
```

当你在 Codex 或其他支持本地 skill 的 agent 中开发插件时，建议明确要求 agent 使用这个 skill。例如：

```text
请使用 @.agents/skills/flexstudio-plugin-developer/SKILL.md 帮我实现这个 FlexStudio 插件功能。
```

这个 skill 会先读取任务路由文件，再按需加载内置的插件开发文档快照，覆盖 Manifest、Unit 定义、后端运行时、前端 iframe Bridge、Host API、依赖插件 API、FlexCLI 命令和市场发布流程。这样可以让 agent 快速定位插件系统的准确约束，避免凭记忆猜测 API 或文件结构。

模板中的文档快照来自 FlexStudioDocumentation 的插件开发章节。文档更新后，模板仓库会通过 CI 同步快照并提交 PR。

创建流程中选择 v2 插件模板。模板会生成标准插件项目，包括：

- `manifest.json`
- `src/backend/`
- `src/frontend/`
- `locales/`
- `assets/`
- `.agents/skills/flexstudio-plugin-developer/`
- `.flexstudio/plugin-docs.json`
- `.github/workflows/publish.yml`
- `.marketplace/README.*.md`

进入插件目录后安装依赖：

```bash
npm install
```

## 检查 manifest

插件必须有唯一 UUID，格式为 `@username/plugin-name`。例如：

```json
{
  "schemaVersion": "1.0",
  "uuid": "@acme/demo-plugin",
  "name": "Demo Plugin",
  "entry": {
    "backend": "dist/backend/index.js",
    "unitFunctionEditor": "dist/frontend/unit-function-editor.html",
    "configPage": "dist/frontend/config-page.html"
  },
  "permissions": ["store", "logger", "definitions", "unit", "ui"],
  "platforms": ["win32-x64", "darwin-arm64", "darwin-x64", "linux-x64"],
  "devices": ["Flexbar"]
}
```

注意：插件版本不写在 manifest 中。插件市场版本来自 GitHub Release tag。

## 编写后端入口

后端通常继承 `FlexPluginBase`：

```ts
import { FlexPluginBase } from '@flexsdk/runtime'
import type { PluginDefinitionsPayload, PluginLoadContext } from '@flexsdk/types'

export default class DemoPlugin extends FlexPluginBase {
  async onLoad(ctx: PluginLoadContext): Promise<void> {
    await super.onLoad(ctx)
    this.logger.info('Demo plugin loaded')
  }

  async onUnload(): Promise<void> {
    this.logger.info('Demo plugin unloaded')
  }

  async getDefinitions(): Promise<PluginDefinitionsPayload> {
    const library = this.createDefaultLibrary({
      libraryUUID: '@acme/demo-plugin/library',
      name: 'Demo Plugin',
    })

    return {
      libraries: [library],
      units: [
        this.createUnitTemplate({
          unitId: '@acme/demo-plugin/demo-unit',
          typeId: 'acme.demo-unit',
          name: 'Demo Unit',
          categoryId: 'demo',
          libraryUUID: library.libraryUUID,
          defaultData: {},
          hasFunctionEditor: true,
        }),
      ],
    }
  }
}
```

## 编写前端页面

插件页面运行在 iframe 中。Vue 页面可以用 `mountFlexPage()` 挂载：

```ts
import { mountFlexPage } from '@flexsdk/runtime'
import UnitFunctionEditor from './UnitFunctionEditor.vue'

mountFlexPage({
  components: {
    unitFunctionEditor: UnitFunctionEditor,
  },
})
```

在组件中使用 `useFlexBridge()` 访问宿主：

```ts
import { useFlexBridge } from '@flexsdk/runtime'

const { unitData, setUnitData, backendRpc, showSnackbarMessage } = useFlexBridge()

async function saveValue(value: string) {
  await setUnitData({ ...unitData.value, value })
  await showSnackbarMessage('Saved')
}

async function callBackend() {
  return backendRpc('doSomething', { id: 1 })
}
```

## 本地开发

启动 FlexStudio 后，在插件目录外或插件目录内运行：

```bash
flexcli plugin-v2 dev .
```

如果 FlexStudio 的开发控制 WebSocket 使用自定义端口或 token：

```bash
flexcli plugin-v2 dev . --host 127.0.0.1 --port 34579 --token <token>
```

CLI 会执行以下动作：

1. 构建插件。
2. 通过 WebSocket 将插件源目录挂载到 FlexStudio。
3. 订阅插件日志。
4. 监听 `manifest.json`、`src/backend`、`src/frontend`、`locales`、`assets` 变化。
5. 文件变化后自动重新构建并触发插件重载。

也可以通过环境变量提供 token：

```bash
FLEX_WS_TOKEN=<token> flexcli plugin-v2 dev .
```

Windows PowerShell：

```powershell
$env:FLEX_WS_TOKEN = '<token>'
flexcli plugin-v2 dev .
```

## 构建、验证和打包

验证 manifest 和定义：

```bash
flexcli plugin-v2 validate --plugin-dir .
```

构建插件：

```bash
flexcli plugin-v2 build --plugin-dir . --out-dir dist
```

打包为 `.flexplugin`：

```bash
flexcli plugin-v2 pack --dist-dir dist
```

如果插件包含 native 能力，必须指定平台：

```bash
flexcli plugin-v2 pack --dist-dir dist --platform win32-x64
```

## 本地安装测试

构建打包后，可以把 `.flexplugin` 安装到 FlexStudio：

```bash
flexcli plugin-v2 install ./release/demo-plugin-universal.flexplugin
```

查看插件列表：

```bash
flexcli plugin-v2 list
```

查看日志：

```bash
flexcli plugin-v2 logs @acme/demo-plugin
```

重载插件：

```bash
flexcli plugin-v2 reload @acme/demo-plugin
```

## 下一步

- 继续阅读 [Manifest 配置](./manifest.md)，补全插件身份、权限、平台和入口。
- 阅读 [Unit 定义](./unit-definitions.md)，为插件注册可用 Unit。
- 阅读 [发布到插件市场](./marketplace-release.md)，配置 GitHub Release 自动发布。
