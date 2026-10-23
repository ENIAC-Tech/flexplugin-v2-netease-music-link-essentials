# 故障排查

本页按开发阶段整理常见问题。优先使用 `flexcli plugin-v2 validate`、`plugin-v2 dev`、`plugin-v2 logs` 和 `plugin-v2 diagnostics` 定位问题。

## Dependency State Channel

- `lacks permission 'pluginApi'`：Provider 注册/发布或 Consumer 订阅的 manifest 缺少 `pluginApi`；分别在使用这些方法的插件中声明权限。
- `does not directly depend on`：Consumer 必须在 `dependencies` 中直接声明 Provider，传递依赖不允许订阅。
- `channel ... is unavailable`：Provider 尚未注册该 channel、已禁用，或进程已经退出；等待新的 `available` 后再订阅或恢复状态。
- payload JSON/64 KiB 错误：payload 根必须是 plain object，不能包含 Date、Map、Set、BigInt、函数、循环引用或非有限数字。
- revision 不连续或 `resyncRequired`：清除 Consumer 本地缓存，使用事件携带的完整 snapshot 覆盖；收到更高 `providerEpoch` 时同样清除旧状态。

## Renderer State Channel

- **unknown channel**：确认后端已在 `await super.onLoad(ctx)` 后调用 `registerRendererStateChannel()`，且前后端 channel 字符串完全一致。
- **missing permission**：Provider 必须满足当前 `pluginApi` permission rule；检查 manifest、capability registry 与 Host 测试是否一致，不要发明新 permission。
- **payload too large**：每个 snapshot/delta 必须是 JSON object，序列化后不超过 64 KiB；缩小 payload，不要拆成轮询 RPC。
- **stale revision**：忽略同 epoch 中小于等于当前 revision 的事件；revision gap 清空缓存并等待 snapshot。
- **no replay**：订阅时传 `{ replayLatest: true }`，并确认 Provider 已发布完整 snapshot。只发布 delta 不能建立初始缓存。
- **unavailable**：清空 UI 缓存并展示不可用。Provider 恢复后的更高 epoch 必须等待新 snapshot，不能沿用旧值。
- **handler errors**：handler 串行运行且无论成功/失败都会 ACK。记录异常并保持 handler 快速；Host 可能设置 `resyncRequired`。
- **forgotten unsubscribe**：Vue unmount 主动调用订阅返回的 async unsubscribe。Host 会在 iframe session 结束时自动清理，但不能代替组件清理。
- **身份参数**：renderer 不提交 plugin UUID 或 session ID；Host 从 iframe session 推导。若示例要求这些参数，说明 API 名称或示例已过时。

## CLI 无法连接 FlexStudio

现象：

```text
WebSocket connection failed
connection refused
```

检查：

- FlexStudio 是否正在运行。
- **设置 > Plugins** 右上角 **Plugin debugging** 对话框中的 **Debug mode**（开发监听）是否开启（默认关闭）；该对话框也显示会话、插件状态和近期日志。
- 设置页是否显示端口占用或监听失败；端口占用时选择其他端口并应用。
- `flexcli plugin-v2 config` 显示的已保存端口是否与宿主一致；首次使用默认为 `34579`。
- 使用 `flexcli plugin-v2 config --port <port>` 保存匹配端口，或在连接命令中显式指定 `--port`。
- host 应为本机 `127.0.0.1`；开发连接直接接受命令。

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
- 使用了 `http` 或 `websocket` 权限，但没有设置 `requiresNetwork: true`。
- `runtime.startupTimeoutMs` 写了极端值，触发 validate warning。

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
| `Duplicate builtin unit template uuid in payload` | 确保 `builtinUnits[].uuid` 在当前 payload 内唯一，且不与插件自有 Unit 生成的模板 UUID 冲突。 |
| `Builtin unit template ... plugin metadata is not allowed` | `builtinUnits` 只能提供普通内置 Unit 模板，删除顶层和嵌套 `data.layoutData` 中的 `plugin` 字段。 |
| `Unknown built-in unit typeId in builtinUnits` | `builtinUnits[].typeId` 必须指向宿主已经注册的内置 Unit 类型，不能使用插件自定义 `typeId`。 |

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

如果日志显示启动超时或插件长时间停留在 starting 阶段，优先检查：

- `onLoad()` 里是否在等待网络登录、全量同步、目录扫描或大文件解析。
- 是否把 definitions 注册放在慢任务之后。
- `runtime.startupTimeoutMs` 是否只是掩盖了不必要的慢启动。

推荐处理：

- 保持 `onLoad()` 简短，只做注册和轻量初始化。
- 把慢任务挪到后台 `jobs` 流程。
- 只在确有必要时调整 `runtime.startupTimeoutMs`。

## Host API 调用失败

常见原因：

- manifest 未声明对应权限。
- 调用了错误命名空间。
- 参数不可序列化。
- 文件路径不存在或无权限。
- 设备未连接。
- Canvas Unit 已卸载但仍在推帧。
- `hostApi.secrets` 记录因宿主安全存储变化而解密失败。
- OAuth provider 没有允许 loopback redirect URI，或回调 `state` 不匹配。
- `jobs.cancel()` 在插件尚未完成清理前被误当成“请求取消”调用。

排查步骤：

1. 查看错误消息中的权限名或方法名。
2. 检查 `manifest.json` 的 `permissions`。
3. 运行 `flexcli plugin-v2 validate --plugin-dir .`。
4. 查看 `flexcli plugin-v2 logs <uuid>`。

与新权限相关的额外检查：

- `secrets`：如果 `get()` 返回 `null` 但 `list()` 还能看到同名且 `encrypted: true` 的记录，通常是旧密文在当前系统上无法解密。让用户重新登录或重新保存 secret，不要尝试读取密文。
- `oauth`：确认 provider 授权地址最终使用的是 loopback `redirect_uri`，并且不要依赖自定义 URI scheme。
- `jobs`：取消流程应先由宿主把 `cancelRequested` 置为 `true`，插件轮询后完成清理，再调用 `jobs.cancel(jobId)` 收尾。

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

## 编辑器写入被拒绝（set-unit-error / convert-unit-error）

症状：`setUnit`、`setUnitData` 或 `convertUnit` 的 Promise 以错误拒绝，宿主弹出“插件无法更新此 Unit”。

先看错误消息：

| 消息 | 原因 | 处理 |
| --- | --- | --- |
| `PLUGIN_SET_UNIT_IDENTITY_CHANGED` | `setUnit` 改了 `uuid`、`typeId` 或 `plugin`。 | 要改变定义用 `convertUnit`，`setUnit` 只改内容。 |
| `PLUGIN_CONVERT_UNKNOWN_TARGET` / `PLUGIN_CONVERT_FOREIGN_SOURCE` | `unitId` 不是本插件的定义，或当前 Unit 不属于本插件。 | 传目标定义的 `plugin.unitId`（不是 `typeId`）。 |
| `PLUGIN_CONVERT_INVALID_DATA` / `..._APPEARANCE` / `..._ICON` | `data` 不是对象、`appearance` 不是数组或 `icon` 不是字符串。 | 修正参数类型。 |
| `PLUGIN_UNIT_INVALID: ...` | 结果不是合法 Unit，后面列出失败的规则。 | 按规则修正；`invalid-value-label-domain` / `unsupported-slider-format` 见下。 |
| `BUILTIN_ICON_UNKNOWN` | 使用了宿主图标表里没有的 `mdi-*` 图标。 | 换一个存在的图标名。 |

`invalid-value-label-domain`：`value-label` 缺少 `data.valueLabel`，或 `format` 不合法（必须恰好一个 `%[0][w][.d]f`，字面 `%` 写成 `%%`）。最常见的原因是用只含绑定字段的数据**整体替换**了 `unit.data`，把 `valueLabel` 丢了。解决办法是基于当前 `unitData` 合并后再写，或通过 `convertUnit` 带上完整的原生配置。这条规则现在在编辑时就会拒绝；如果是更早的写入留下的旧数据，上传时会报同样的原因，并带上页面名和 Unit 名，打开那个 Unit 的编辑器重写即可。

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

- workflow 是否固定到官方 tag，例如 `@v1.3.0`。
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

## Composite 或 Button Group 被拒绝

| 现象／错误 | 检查与处理 |
| --- | --- |
| `CAPABILITY_UNSUPPORTED` | 宿主、SDK、固件需同时支持 Composite v1；不要退回 canvas。 |
| `STALE_GENERATION` / `OWNER_MISMATCH` | 从当前 load 取序列号、UUID 与 generation，按插件和实例隔离，不复用旧目标。 |
| `CACHE_MISS` | 未找到已确认部署的配置或快照；不能读取编辑稿代替。 |
| `RESULT_UNKNOWN` | 事务已发出但没有收到设备应答；先读设备实际快照确认，再决定是否重做，不要盲目重发业务。 |
| `NOT_WRITABLE` | 检查精确属性路径、保存元素结构，以及固定的 Button mode/initialStateId。 |
| `COMPOSITE_RESOURCE_*` | 检查完整 embedded Theme、canonical base64、真实 SHA-256/字节数、image-only 闭包与限额。 |
| 模板在空项目无法插入 | 不可只声明 asset UUID；资源必须随 composite.resources 携带，并经真实图像检查。 |
| `PLUGIN_UNIT_WRITE_STALE` | 转换或写入等待期间上下文变化；重新读取当前 Unit，避免覆盖更新。 |
| 旧按钮组定义失败 | v1 要求 presentationVersion: 1、共享 background/foregroundColor/fontFamily/fontSize/iconSize 与四种布局预设；不接受旧显示枚举、逐按钮外观或 activeColor。 |

尺寸不足时先检查布局退化提示和字号档位；使用宿主的“按当前尺寸重新计算档位”，不要运行时换任意字号或字体。插件缺失时保存外观和资源仍保留，离线 Button 禁止业务触摸。
