# 插件系统概览

FlexStudio 插件系统由五个部分组成：

- FlexStudio 主进程：安装、卸载、加载、启用、禁用、重载插件，管理后端进程、能力注册表、插件资源协议、插件日志和本地调试控制服务。
- FlexStudio 渲染进程：展示插件提供的 Unit、编辑器页面、配置页面和运行视图，并为 iframe 建立桥接通道。
- FlexSDK2：提供插件 manifest 类型、运行时基类、定义校验、前端桥接和 Vue 组合式 API。
- FlexCLI：提供插件创建、构建、验证、打包、本地安装、热重载调试和日志查看能力。
- 插件市场：通过 GitHub Release 接收插件包，管理插件列表、版本、依赖、收藏、评分、举报、安装和更新。

## 系统结构图

可以把插件理解为“两段式运行”：后端负责能力和数据，前端负责界面。FlexStudio 主进程管理后端进程、权限、资源协议和 Host API；渲染进程管理 iframe、Unit 编辑器、运行视图和用户交互。

## 运行模型

插件由 `manifest.json` 声明身份、入口、权限、平台、设备、依赖和资源。FlexStudio 安装插件后，会读取 manifest，校验插件结构，将插件状态写入本地仓库，并在插件启用时加载插件定义。通过插件市场安装的插件还会在本地状态中记录 `marketplaceListingId`，用于详情页跳转、更新检查和后续升级。

插件后端运行在独立进程中。FlexStudio 主进程负责创建后端进程、注入 Host API、转发日志、处理插件生命周期，并在插件退出或重载时清理资源。插件后端通过 SDK 的 `FlexPluginBase` 注册定义、监听事件、调用 Host API、处理前端 RPC。

插件前端页面运行在 iframe 中。FlexStudio 使用 `plugin-asset://` 协议加载插件构建产物，通过 `MessageChannel` 建立 iframe 与宿主之间的通信。插件页面可以获取主题、语言、当前 Unit 数据、发送数据更新、调用后端 RPC、显示宿主 snackbar，并通知宿主页面已准备好。

## 数据与调用链

### Unit 定义注册

插件后端返回完整 `PluginDefinitionsPayload`。主进程先做 schema 和一致性校验，再把 Library 与 Unit 写入 Definition Registry。渲染进程查询 active units 后，插件 Unit 才会出现在资源面板和编辑器里。

### 前端调用后端

插件前端不能直接访问后端进程。`backendRpc()` 会先经过 iframe bridge，再通过 preload IPC 到主进程，最后由 Plugin Manager 转发给插件后端进程中通过 `registerRendererRpc()` 注册的方法。

### 后端调用宿主能力

Host API 不是自由调用接口。每次调用都会经过 Capability Registry，并根据 manifest 中的 `permissions` 做权限校验。未声明权限时，调用会被拒绝。

### 后端调用直接依赖插件

插件后端可以通过依赖 API 调用 manifest 中声明的直接依赖插件。调用方使用 `hostApi.plugin.callDependency()` 发起请求，宿主校验 `pluginApi` 权限、直接依赖关系和目标插件启用状态后，把请求转发到目标插件后端中通过 `registerDependencyApi()` 注册的方法。

依赖 API 不会自动授予传递性调用权限。`plugin-a -> plugin-b -> plugin-c` 中，`plugin-a` 只能调用 `plugin-b`；如果需要使用 `plugin-c` 的能力，应由 `plugin-b` 暴露自己的 API 进行组合或转发。开发细节见 [插件依赖 API](./dependency-api.md)。

### 项目中的插件依赖快照

项目不会维护一份全局插件清单。每个 preset 会维护自己的 `pluginDependencies` 快照，记录该 preset 中正式 Unit 使用到的插件 UUID、版本、市场 listing id、Unit 数量和更新时间。项目打开时只汇总各 preset 的快照，不再遍历所有 Unit 重新推导依赖。

这样做是为了支持 preset 作为独立内容分享：preset 自带所需插件信息，导入到任何项目后都能参与缺失插件、插件版本不足和 Unit 数据迁移检查。编辑 preset、添加或删除插件 Unit、替换嵌套 layoutData 时，宿主会刷新对应 preset 的快照。

打开项目时，FlexStudio 会加载本机已安装插件并检查汇总后的依赖：

- 缺失插件：提示用户安装，确认后进入 Marketplace 插件页或以插件 UUID 搜索。
- 已安装但版本低于 preset 需求：提示用户更新，确认后进入对应插件详情页。
- 已安装版本高于 preset 内 Unit 记录的版本：先尝试执行 Unit 迁移 Hook，再继续缺失/更新检查。

## 生命周期

典型生命周期如下：

1. FlexStudio 注册 `plugin-asset://` 协议和插件相关 IPC。
2. 主进程初始化插件管理器，读取已安装插件仓库。
3. 插件管理器加载启用状态的插件，启动插件后端进程。
4. 插件后端执行 `onLoad()`，并通过 `getDefinitions()` 或 `registerDefinitions()` 提供 Library 与 Unit 定义。
5. 渲染进程查询当前可用的插件 Unit，并在资源面板、编辑器和运行视图中展示。
6. 用户打开插件页面时，渲染进程创建 iframe 并建立桥接通道。
7. 插件页面通过前端桥接读取或更新 Unit 数据，必要时通过 `backendRpc()` 调用插件后端。
8. 插件从市场更新完成后，FlexStudio 会重新加载插件，并对当前项目中旧版本插件 Unit 调用可选的 `migrateUnit()` Hook。
9. 打开项目时，如果 preset 依赖快照显示项目内存在旧版本插件 Unit，FlexStudio 会对已安装的新版本插件执行同一套 Unit 迁移流程。
10. 插件被禁用、卸载或重载时，FlexStudio 调用 `onUnload()`，关闭后端进程，注销定义和事件订阅。

## 主进程职责

FlexStudio 主进程的插件系统核心职责包括：

- 插件安装、卸载、启用、禁用、重载。
- 插件市场更新检查、安装来源记录和更新提示。
- 插件仓库状态持久化。
- manifest 读取与校验。
- 插件依赖检查和依赖 API 调用路由。
- 后端进程创建、心跳、退出和日志转发。
- Host API 权限校验和调用分发。
- 插件定义注册、注销和活动 Unit 列表生成。
- `plugin-asset://` 资源协议注册。
- iframe 桥接、后端 RPC 和宿主事件转发。
- CLI 本地开发控制 WebSocket。

## 插件页面类型

插件可以在 manifest 中声明以下前端入口：

| 入口 | 用途 |
| --- | --- |
| `unitFunctionEditor` | Unit 功能编辑器页面。 |
| `unitAppearanceEditor` | Unit 外观编辑器页面。 |
| `unitView` | 自定义 Unit 的运行视图。 |
| `unitViewOverrides` | 按 `typeId` 为不同 Unit 指定不同运行视图。 |
| `configPage` | 插件配置页面。 |

所有前端入口都运行在 iframe 中，并通过 SDK 的前端桥接访问宿主上下文。

## Unit 类型与页面关系

| Unit 类型 | 运行视图 | 可选编辑器 | 典型用途 |
| --- | --- | --- | --- |
| `standard` | FlexStudio 默认 Unit 视图 | 功能编辑器、外观编辑器 | 快捷动作、系统命令、HTTP 请求等逻辑型 Unit。 |
| `custom` | 插件提供的 `unitView` iframe | 功能编辑器、外观编辑器 | 需要完全自定义前端运行视图的 Unit。 |
| `canvas` | 无 iframe，由后端推送图片帧 | 功能编辑器 | 后端生成画面并推送到设备屏幕的 Unit。 |
| `cycled` | FlexStudio 默认多状态视图 | 功能编辑器、外观编辑器 | 插件控制的播放/暂停、模式切换等多状态按键。 |
| `slider` | FlexStudio 默认滑块视图 | 功能编辑器、外观编辑器 | 插件控制的音量、亮度、温度等数值滑块。 |
| `value-label` | FlexStudio 预览运行时文本；设备端用 atlas 绘制 | 功能编辑器、外观编辑器 | 插件控制的数值显示，不需要 canvas 实时推图。 |
| `label` | FlexStudio 预览运行时文本；设备端用预置 TTF 绘制 | 功能编辑器、外观编辑器 | 插件控制的 Unicode 文本显示。 |

## 权限模型

插件只能调用 manifest 中声明过的权限。Host API 每个能力都会检查对应权限，例如文件系统 API 需要 `file`，HTTP API 需要 `http`，插件本地存储需要 `store`，Electron 剪贴板能力需要 `electron.clipboard`。

权限分为基础权限和敏感权限：

- 基础权限：`store`、`logger`、`device`、`definitions`、`bus`、`unit`、`ui`、`pluginApi`。
- 敏感权限：`file`、`http`、`system`、`project`、`resource` 和全部 `electron.*` 权限。

开发时应只声明实际需要的权限。权限越少，安装审核和用户信任成本越低。

## 本地开发与发布

本地开发通常使用 `flexcli plugin-v2 dev <plugin-dir>`。CLI 会构建插件、通过 FlexStudio 的开发控制 WebSocket 挂载插件源目录、订阅日志、监听文件变化，并在变化后触发重载。

正式发布不通过 CLI 直接上传市场。插件必须开源在 GitHub，并通过 GitHub Release 发布 `.flexplugin` 包。官方 reusable workflow 会构建、打包、上传 Release Asset，并通过 webhook 通知插件市场。插件市场只把 webhook 视为通知，实际插件包会由服务端独立从 GitHub Release 拉取。

<!-- plugin-cycled-slider:start -->
## Plugin cycled、slider、value-label 与 label Unit

插件 Unit 现在支持七种运行形态：`standard`、`custom`、`canvas`、`cycled`、`slider`、`value-label`、`label`。

`cycled`、`slider`、`value-label` 和 `label` 不是独立的插件 iframe 渲染体系，而是复用宿主已有 Unit 架构：

- `cycled` 复用内置 `cycled-key` 的多状态外观和编辑体验，但函数列表由插件定义固定提供，用户不能新增、删除或排序函数。
- `slider` 复用内置音量滑块的外观和交互，范围、步进和显示格式由插件定义提供。
- `value-label` 复用宿主外观编辑和预渲染流程，但 primary text 由设备端使用宿主生成的 atlas 本地绘制。
- `label` 复用宿主外观编辑和预渲染流程，但 primary text 由设备端使用预置 `puhuiti` 或 `consola` TTF 绘制。
- 插件可通过后端 Unit API 监听设备事件，并主动更新设备显示状态。
- 宿主只负责转发、校验、格式化和生成设备渲染元数据，不会替插件执行业务状态切换。

典型数据流是：设备上报交互事件 -> 宿主按 Unit owner 转发给插件 -> 插件执行业务逻辑 -> 插件通过 Host API 更新设备状态或通过通知 API 报错。
<!-- plugin-cycled-slider:end -->
