# Manifest 配置

`manifest.json` 描述插件包的身份、入口、权限、平台、设备、依赖和本地化信息。FlexStudio 安装和加载插件时会首先读取 manifest。

## 最小示例

```json
{
  "schemaVersion": "1.0",
  "uuid": "@acme/demo-plugin",
  "name": "Demo Plugin",
  "entry": {
    "backend": "dist/backend/index.js"
  }
}
```

## 完整示例

```json
{
  "schemaVersion": "1.0",
  "uuid": "@acme/demo-plugin",
  "name": "Demo Plugin",
  "repo": "https://github.com/acme/demo-plugin",
  "description": "Example plugin for FlexStudio.",
  "author": {
    "name": "Acme",
    "email": "dev@example.com",
    "url": "https://example.com"
  },
  "minHostVersion": "2.0.0",
  "native": false,
  "platforms": ["win32-x64", "darwin-arm64", "darwin-x64", "linux-x64"],
  "requiresNetwork": true,
  "runtime": {
    "startupTimeoutMs": 15000
  },
  "devices": ["Flow2Pro"],
  "requiredCapabilities": ["encoder", "touchscreen"],
  "permissions": ["store", "logger", "definitions", "unit", "ui", "http", "jobs"],
  "dependencies": [
    {
      "uuid": "@acme/base-plugin",
      "minVersion": "1.2.0"
    }
  ],
  "hasConfigPage": true,
  "entry": {
    "backend": "dist/backend/index.js",
    "unitFunctionEditor": "dist/frontend/unit-function-editor.html",
    "unitAppearanceEditor": "dist/frontend/unit-appearance-editor.html",
    "unitView": "dist/frontend/unit-view.html",
    "unitViewOverrides": {
      "demo-unit": "dist/frontend/demo-unit-view.html"
    },
    "configPage": "dist/frontend/config-page.html"
  },
  "defaultLocale": "en",
  "supportedLocales": ["en", "zh"]
}
```

## 字段参考

Dependency State Channel 不新增 manifest 字段或 permission enum。订阅其他插件状态的 Consumer 复用 `pluginApi`，并必须在 `dependencies` 中声明 Provider 为直接依赖；只注册或发布状态的 Provider 不需要新增权限。

Renderer State Channel 同样不新增 manifest 字段或 permission enum。Provider 注册/发布沿用当前 `pluginApi` permission rule；订阅仅授权给同一插件的 Host 认证 renderer session，因此无需也不得在 manifest、订阅参数或 payload 中声明 plugin UUID/session identity。它不要求 `dependencies`。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `schemaVersion` | `'1.0'` | 是 | manifest schema 版本。当前使用 `1.0`。 |
| `uuid` | `string` | 是 | 插件唯一标识，格式为 `@username/plugin-name`。 |
| `name` | `string` | 是 | 插件显示名称。 |
| `repo` | `string` | 否 | 插件源代码仓库 URL。发布到市场时建议填写 GitHub 仓库地址。 |
| `description` | `string` | 否 | 插件简短描述。 |
| `author` | `PluginAuthor` | 否 | 插件作者信息。 |
| `minHostVersion` | `string` | 否 | 最低 FlexStudio 版本要求。 |
| `native` | `boolean` | 否 | 是否包含平台相关 native 能力。native 插件必须按平台构建和打包。 |
| `platforms` | `PluginPlatform[]` | 否 | 支持的平台。当前文档与校验器都使用 `win32-x64`、`darwin-arm64`、`darwin-x64`、`linux-x64`。 |
| `requiresNetwork` | `boolean` | 否 | 是否会访问互联网或局域网。需要联网的插件应设置为 `true`，市场的网络徽标只基于这个字段。 |
| `runtime` | `PluginRuntimeManifest` | 否 | 后端运行时元数据，例如启动超时和预期内存占用。 |
| `devices` | `string[]` | 否 | 支持的设备型号。 |
| `requiredCapabilities` | `DeviceCapability[]` | 否 | 运行时要求的设备能力。 |
| `permissions` | `PluginPermission[]` | 否 | 插件需要的宿主权限。 |
| `dependencies` | `PluginDependency[]` | 否 | 依赖的其他插件及最低版本。 |
| `hasConfigPage` | `boolean` | 否 | 是否提供插件配置页。 |
| `entry` | `PluginEntryPoints` | 是 | 后端和前端入口。 |
| `defaultLocale` | `string` | 否 | 默认语言。 |
| `supportedLocales` | `string[]` | 否 | 插件支持的语言列表。 |

## UUID 规则

插件 UUID 必须匹配：

```text
^@[a-zA-Z0-9_-]+/[a-zA-Z0-9._-]+$
```

示例：

```text
@eniacelec/flex-plugin-example
@acme/media-controls
@my_team/device-tools
```

UUID 应长期稳定。发布后修改 UUID 会被视为一个新插件。

## 版本规则

manifest 不包含 `version` 字段。本地插件安装时，FlexStudio 使用插件包内 `package.json` 的 `version` 作为插件版本。通过插件市场安装时，优先使用 GitHub Release tag 版本；如果没有 Release/tag 版本，才回退到 `package.json` 的 `version`。

建议使用语义化版本 tag：

```text
v1.0.0
v1.1.0
v2.0.0
```

发布 CI 会在构建前校验规范化后的 Release tag 版本与 `package.json` 的 `version` 是否一致。`v1.2.0` 会规范化为 `1.2.0`；二者不一致时发布失败。

插件依赖中的 `minVersion` 也应使用可比较的版本号。

## Entry Points

```ts
interface PluginEntryPoints {
  backend: string
  unitFunctionEditor?: string
  unitAppearanceEditor?: string
  unitView?: string
  unitViewOverrides?: Record<string, string>
  configPage?: string
}
```

| 字段 | 说明 |
| --- | --- |
| `backend` | 插件后端入口，必填。通常指向 `dist/backend/index.js`。 |
| `unitFunctionEditor` | 通用 Unit 功能编辑器页面。 |
| `unitAppearanceEditor` | 通用 Unit 外观编辑器页面。 |
| `unitView` | 通用自定义 Unit 运行视图。 |
| `unitViewOverrides` | 按 `typeId` 指定不同运行视图。 |
| `configPage` | 插件配置页面。 |

`entry` 路径必须指向插件包内文件。不要填写开发服务器 URL，也不要指向源码文件。

## 平台

当前平台枚举：

| 值 | 说明 |
| --- | --- |
| `win32-x64` | Windows x64。 |
| `darwin-arm64` | macOS Apple Silicon。 |
| `darwin-x64` | macOS Intel。 |
| `linux-x64` | Linux x64。 |

非 native 插件通常可以声明全部平台，并打包为 universal 包。native 插件必须为每个平台分别构建 `.flexplugin` 包。

`native` 和 `platforms` 只描述插件包的交付形态与宿主兼容性，不负责实现系统自动化逻辑。需要原生能力、桌面集成或系统自动化时，业务逻辑应写在插件自己的后端代码或 native helper 中；FlexStudio core 只提供插件生命周期、权限校验、运行时 API 和市场兼容性标记。

## 网络元数据

`requiresNetwork` 用于声明插件是否会访问互联网或局域网。只要插件会主动访问远端 API、LAN 服务、路由器、本机其他服务，或建立 WebSocket 长连接，就应设置：

```json
{
  "requiresNetwork": true
}
```

注意：

- `requiresNetwork` 是市场和宿主展示的元数据，不会替代权限控制。
- 真正的 Host API 能力仍由 `permissions` 决定；HTTP/HTTPS 需要 `http`，WebSocket 需要 `websocket`。
- 市场网络徽标只基于 `requiresNetwork`，不会根据 `http` / `websocket` 自动推断。
- 纯本地插件应保持缺省或显式写为 `false`，避免误导用户。

## 运行时元数据

`runtime` 是可选对象，用于描述插件后端进程的启动和资源预期：

```ts
interface PluginRuntimeManifest {
  startupTimeoutMs?: number
  expectedIdleMemoryMb?: number
  expectedActiveMemoryMb?: number
  backgroundService?: boolean
}
```

当前建议重点使用 `runtime.startupTimeoutMs`。它表示插件后端从进程启动到完成 `onLoad()` 的期望窗口。FlexCLI 会接受任意数字，但对超出文档范围的值给出警告；当前文档范围是 `1000-120000` ms，FlexStudio 会对实际值做 clamp。

建议：

- 默认先保持不写，只有确实存在可解释的慢启动需求时再声明。
- 不要把网络同步、全量索引或大文件扫描塞进启动阶段来“配合”更大的超时；应让 `onLoad()` 尽快完成，再把慢任务放到后台 job。
- `expectedIdleMemoryMb`、`expectedActiveMemoryMb` 和 `backgroundService` 主要用于补充宿主对插件运行形态的认知，不能替代你自己的内存管理和任务调度。

## 设备能力

当前设备能力枚举：

| 值 | 说明 |
| --- | --- |
| `encoder` | 旋钮或编码器输入。 |
| `touchscreen` | 触摸屏。 |
| `knob` | 旋钮。 |
| `slider` | 滑杆。 |
| `lcd` | LCD 显示能力。 |
| `vibration` | 振动反馈。 |

如果插件没有硬性设备能力要求，可以不填写 `requiredCapabilities`。

## 权限

插件只能调用已声明权限对应的 Host API。

基础权限：

| 权限 | 说明 |
| --- | --- |
| `store` | 插件持久化存储和配置。 |
| `logger` | 插件日志。 |
| `device` | 设备配置和设备能力查询。 |
| `definitions` | 注册插件 Library 与 Unit 定义。 |
| `input` | 注册并接收输入功能、发布当前绑定反馈与功能可用状态；详见[输入功能](./input-functions.md)。 |
| `bus` | 订阅或取消订阅宿主事件总线。 |
| `unit` | Unit 事件订阅、Canvas 推帧等 Unit 能力。 |
| `chart` | 注册并发布插件自定义 Chart 性能/传感器数据源，供内置 Chart Unit 选择和显示。 |
| `ui` | 宿主 UI 消息，例如 snackbar。 |
| `pluginApi` | 调用直接依赖插件暴露的依赖 API。 |

敏感权限：

| 权限 | 说明 |
| --- | --- |
| `file` | 文件系统读写、目录操作和删除。 |
| `http` | 可通过 `hostApi.http.get` 和通用 `hostApi.http.request` 发起 HTTP/HTTPS 请求。 |
| `websocket` | 敏感权限，可通过 `hostApi.ws.connect` 打开长连接 WebSocket。 |
| `secrets` | 插件级敏感凭据存储。适合 access token、refresh token、API key。 |
| `oauth` | 宿主协助完成 loopback OAuth 授权阶段。token exchange 和持久化仍由插件负责。 |
| `jobs` | 创建和更新宿主拥有的后台任务记录，用于长时同步、扫描或导入。 |
| `system` | 系统平台、CPU、内存和应用版本信息。 |
| `project` | 项目相关能力。 |
| `resource` | 资源库相关能力。 |
| `electron.app` | Electron app 信息和路径。 |
| `electron.browserWindow` | 主窗口控制。 |
| `electron.clipboard` | 剪贴板读写。 |
| `electron.globalShortcut` | 全局快捷键注册。 |
| `electron.powerMonitor` | 系统空闲状态。 |
| `electron.dialog` | 打开文件、保存文件和消息框。 |
| `electron.pushNotifications` | 推送通知注册。 |
| `electron.screen` | 屏幕和显示器信息。 |

建议只声明实际使用的最小权限集合。

## 依赖

```ts
interface PluginDependency {
  uuid: string
  minVersion: string
}
```

依赖规则：

- 依赖通过插件 UUID 指定。
- 当前依赖关系只表达最低版本要求，即 `>= minVersion`。
- 市场安装时会解析依赖，并检查依赖深度。最大依赖深度为 6。
- 有其他插件依赖的插件不能直接删除，只能归档。
- 如果插件需要调用依赖插件暴露的后端 API，调用方还必须在 `permissions` 中声明 `pluginApi`。只暴露 API、不调用其他插件的插件不需要该权限。
- 依赖 API 只允许调用 manifest 中声明的直接依赖；传递性依赖不会自动授予调用权限。

更多依赖 API 的后端用法见 [插件依赖 API](./dependency-api.md)。

## 本地化

`defaultLocale` 指定默认语言，`supportedLocales` 指定支持语言。语言资源通常放在 `locales/` 目录，并随插件包一起发布。

市场详情页不是从 manifest 中读取，而是优先读取 `.marketplace/README.{lang}.md`，找不到时回退到根目录 `README.md`。
