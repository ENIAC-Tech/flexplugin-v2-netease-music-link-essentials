# 故障排查

本页按开发阶段整理常见问题。优先使用 `flexcli plugin-v2 validate`、`plugin-v2 dev`、`plugin-v2 logs` 和 `plugin-v2 diagnostics` 定位问题。

## CLI 无法连接 FlexStudio

现象：

```text
WebSocket connection failed
connection refused
unauthorized
```

检查：

- FlexStudio 是否正在运行。
- 端口是否为默认 `34579`。
- 是否需要 token。
- `--host`、`--port`、`--token` 是否与 FlexStudio 控制服务一致。
- 环境变量 `FLEX_WS_TOKEN` 或 `PLUGIN_WS_TOKEN` 是否正确。

示例：

```bash
flexcli plugin-v2 diagnostics --host 127.0.0.1 --port 34579
```

## manifest 校验失败

常见原因：

- `schemaVersion` 不是 `1.0`。
- `uuid` 不符合 `@owner/plugin-name` 格式。
- `entry.backend` 缺失。
- `entry` 指向源码文件而不是构建产物。
- `permissions` 中包含未知权限。
- native 插件没有正确声明 `platforms`。

运行：

```bash
flexcli plugin-v2 validate --plugin-dir .
```

修复后重新构建：

```bash
flexcli plugin-v2 build --plugin-dir . --out-dir dist
```

## 插件安装成功但没有 Unit

检查：

- 插件是否已启用。
- 后端进程是否启动成功。
- `getDefinitions()` 是否返回非空 `units`。
- `libraries` 和 `units` 是否通过校验。
- `typeId` 是否与其他插件冲突。
- Unit 的 `libraryUUID` 是否存在。
- `plugin.pluginUUID` 是否等于当前插件 UUID。
- `plugin.unitId` 是否等于外层 `unitId`。

查看日志：

```bash
flexcli plugin-v2 logs @owner/plugin-name
```

查看诊断：

```bash
flexcli plugin-v2 diagnostics
```

## definitions 校验失败

常见错误和修复：

| 错误 | 修复 |
| --- | --- |
| `Duplicate libraryUUID` | 确保每个 Library ID 唯一。 |
| `Duplicate unitId` | 确保同一插件内 `unitId` 唯一。 |
| `typeId is already registered` | 换一个全局唯一 `typeId`。 |
| `references unknown libraryUUID` | 先声明对应 Library，或修正 Unit 的 `libraryUUID`。 |
| `plugin.pluginUUID must match` | 使用 `this.pluginUUID` 或 `createUnitTemplate()`。 |
| `plugin.unitId must match unitId` | 保持外层 `unitId` 与 `plugin.unitId` 一致。 |
| `custom requires hasView: true` | 为 custom Unit 设置 `hasView: true` 并提供 `unitView` 入口。 |
| `canvas cannot have hasView: true` | Canvas Unit 不使用 iframe 运行视图。 |
| `canvas cannot have hasAppearanceEditor: true` | Canvas Unit 不能提供外观编辑器。 |

建议使用 SDK helper：

```ts
this.createUnitTemplate({
  unitId: '@owner/plugin/unit',
  typeId: 'owner.plugin.unit',
  name: 'Unit',
  categoryId: 'plugin',
})
```

## 后端进程启动失败

检查：

- `entry.backend` 是否存在于 dist 目录。
- 后端构建是否成功。
- 后端依赖是否已安装或打包。
- Node ESM/CJS 配置是否与构建产物匹配。
- 默认导出是否为插件类。
- `onLoad()` 中是否抛错。

命令：

```bash
flexcli plugin-v2 build --plugin-dir . --out-dir dist
flexcli plugin-v2 logs @owner/plugin-name
```

如果覆盖 `onLoad()`，确认调用：

```ts
await super.onLoad(ctx)
```

否则 `this.hostApi`、`this.logger`、`this.pluginUUID` 和 `this.pluginVersion` 不会初始化。

## Host API 调用失败

常见原因：

- manifest 未声明对应权限。
- 调用了错误命名空间。
- 参数不可序列化。
- 文件路径不存在或无权限。
- 设备未连接。
- Canvas Unit 已卸载但仍在推帧。

排查步骤：

1. 查看错误消息中的权限名或方法名。
2. 检查 `manifest.json` 的 `permissions`。
3. 运行 `flexcli plugin-v2 validate --plugin-dir .`。
4. 查看 `flexcli plugin-v2 logs <uuid>`。

## 插件依赖 API 调用失败

常见错误和处理方式：

| 错误 | 处理方式 |
| --- | --- |
| `Permission denied: pluginApi` | 调用方 manifest 的 `permissions` 中加入 `pluginApi`，重新构建并安装。 |
| `cannot call ... because it is not a declared direct dependency` | 在调用方 manifest 的 `dependencies` 中声明目标插件，或改为通过已声明的中间依赖转发。 |
| `Dependency plugin ... is not enabled` | 确认目标依赖插件已安装并启用。 |
| `Dependency API '<method>' is not registered` | 确认目标插件后端在 `onLoad()` 中调用了 `registerDependencyApi()`，并且方法名完全一致。 |
| `Dependency API timeout` | 查看目标插件日志，检查 handler 是否阻塞、目标插件是否崩溃或进入 degraded 状态。 |

排查顺序：

1. 检查调用方和目标插件的 `dist/manifest.json`，确认构建产物里的 `permissions` 和 `dependencies` 已更新。
2. 确认调用方只调用直接依赖，不依赖传递性关系。
3. 使用 `flexcli plugin-v2 logs <dependency-uuid>` 查看目标插件后端日志。
4. 如果调用由前端按钮触发，先确认前端调用的是本插件后端的 `backendRpc()`，再由后端调用 `hostApi.plugin.callDependency()`。

完整 API 说明见 [插件依赖 API](./dependency-api.md)。

## 前端 bridge 初始化超时

错误：

```text
Frontend bridge init timed out. Make sure this page is running inside FlexStudio as a plugin iframe.
```

检查：

- 页面是否在 FlexStudio 插件 iframe 中打开，而不是直接在浏览器中打开。
- manifest 中对应 `entry` 路径是否正确。
- 前端构建产物是否存在。
- `plugin-asset://` 资源是否可加载。
- 页面入口是否调用了 `mountFlexPage()` 或 `createFrontendBridge()`。
- iframe 是否被 CSP 或脚本错误阻止执行。

本地开发时重新构建并重载：

```bash
flexcli plugin-v2 build --plugin-dir . --out-dir dist
flexcli plugin-v2 reload @owner/plugin-name
```

## 前端页面没有跟随主题

如果使用 `mountFlexPage()`，SDK 会自动同步主题。若 Vuetify 没有同步，显式传入 Vuetify 实例：

```ts
mountFlexPage({
  components: { configPage: ConfigPage },
  setupApp(app) {
    app.use(vuetify)
  },
  themeSync: {
    vuetify,
    lightThemeName: 'light',
    darkThemeName: 'dark',
  },
})
```

## setUnitData 后 UI 没更新

检查：

- 是否等待了 `isReady`。
- 是否使用了 `unitData.value`。
- 是否传入完整的新对象，而不是原地修改旧对象。
- 对于外观编辑器或运行视图，是否应使用 `getUnit()` / `setUnit()`。

推荐写法：

```ts
await setUnitData({
  ...unitData.value,
  title: nextTitle,
})
```

## backendRpc 找不到方法

错误：

```text
No renderer RPC handler registered for method: <method>
```

检查：

- 后端是否在 `onLoad()` 中注册了 `registerRendererRpc()`。
- 方法名是否完全一致。
- 前端参数是否是数组。
- 后端进程是否已重载。

后端：

```ts
this.registerRendererRpc('lookupUser', async (id: string) => {
  return { id }
})
```

前端：

```ts
await backendRpc('lookupUser', ['42'])
```

## Canvas 推帧停止或报错

常见原因：

- Unit 已从设备卸载。
- 设备已断开。
- 推送的不是 PNG Buffer。
- 渲染循环没有在 unload 时停止。
- 推帧频率过高。

建议：

- 使用 `onCanvasUnitLoad()` 启动渲染。
- 使用 `onCanvasUnitUnload()` 停止渲染。
- 捕获 `pushFrame()` 错误，并用 `isCanvasPushTerminalError()` 判断是否终止。
- 控制帧率不超过 60fps。

## 打包失败

检查：

- 是否先运行了 `flexcli plugin-v2 build`。
- `dist/manifest.json` 是否存在。
- manifest entry 指向的文件是否存在。
- native 插件是否传入 `--platform`。
- `--platform` 是否是支持值。

命令：

```bash
flexcli plugin-v2 build --plugin-dir . --out-dir dist
flexcli plugin-v2 pack --dist-dir dist
```

native 示例：

```bash
flexcli plugin-v2 pack --dist-dir dist --platform darwin-arm64
```

## GitHub Actions 发布失败

检查：

- workflow 是否固定到官方 tag，例如 `@v1.1.0`。
- 是否错误使用 `@main`。
- 仓库 secret `FLEX_MARKETPLACE_WEBHOOK_SECRET` 是否存在。
- Release 是否是 `published`，不是 draft。
- `npm ci` 是否成功。
- `npm run build` 是否成功。
- Release Asset 是否上传成功。
- native 插件的平台矩阵是否与 manifest 一致。

重新发布时，建议创建新的 semver tag。不要复用已经被市场处理过的 tag。

## 市场没有收到新版本

检查：

- 当前 Release 是否为仓库第一个已发布的非 draft Release。官方 workflow 对首次 Release 会跳过 marketplace notify。
- workflow 的 notify job 是否执行。
- webhook secret 是否正确。
- `manifest.uuid` 是否与市场中注册的插件一致。
- GitHub 仓库是否与插件 listing 绑定。
- Release Asset 是否包含 `.flexplugin`。
- 市场审核状态是否允许更新。

## 插件更新或 Unit 迁移失败

症状可能包括：更新后旧项目里的插件 Unit 数据没有变化、Unit 显示旧字段、打开项目时提示迁移失败，或插件管理页显示有更新但无法更新。

检查：

- 插件是否通过 Marketplace 安装；本地开发插件没有 `marketplaceListingId`，不会走市场更新入口。
- 旧 Unit 的 `plugin.pluginVersion` 是否低于当前已安装插件版本。
- 插件后端是否启用；`migrateUnit()` 只会在目标插件已加载且启用时调用。
- `migrateUnit()` 是否对目标 `unitId` 返回了 `undefined`，导致宿主按 no-op 处理。
- 返回 `{ data }` 时是否返回了完整可序列化对象。
- 返回 `{ unit }` 时是否错误改变了 `uuid`、`typeId`、`plugin.pluginUUID`、`plugin.unitId` 或 `geometry`。
- 迁移逻辑是否幂等，是否正确处理旧数据缺失字段。

建议：

- 在 `unit.data` 中保存 `schemaVersion`，按版本分支迁移。
- 在迁移 Hook 中只改插件拥有的数据，不要改变用户布局。
- 迁移失败时先查看插件日志，再用旧项目复现并单独测试相关 Unit。
- 如果市场新版本没有出现，先按“市场没有收到新版本”排查 Release 和 webhook。

## 删除插件失败

如果插件被其他插件依赖，市场不允许直接删除。处理方式：

- 先查看 dependents。
- 如果仍有依赖方，只能归档。
- 归档后插件会从搜索中隐藏，但仍可作为依赖被安装。
- 取消归档需要重新审核。

## 仍然无法定位

收集以下信息再排查：

```bash
flexcli plugin-v2 validate --plugin-dir .
flexcli plugin-v2 diagnostics
flexcli plugin-v2 logs @owner/plugin-name
```

同时检查：

- `manifest.json`
- `dist/manifest.json`
- GitHub Actions run log
- FlexStudio 插件市场中的插件状态
- 插件是否启用
- 插件是否有未满足依赖
