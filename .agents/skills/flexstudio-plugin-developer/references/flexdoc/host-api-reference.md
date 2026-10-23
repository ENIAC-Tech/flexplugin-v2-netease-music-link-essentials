# Host API Reference

Host API 是 FlexStudio 暴露给插件后端进程的受权限控制能力集合。插件通过 `this.hostApi` 访问这些能力。

```ts
const platform = await this.hostApi.system.getPlatform()
await this.hostApi.ui.showSnackbarMessage({ message: 'Done', type: 'success' })
```

插件必须在 `manifest.json` 的 `permissions` 中声明对应权限。未声明权限时调用会失败。

## 权限与命名空间

| 命名空间 | 权限 | 说明 |
| --- | --- | --- |
| `hostApi.file` | `file` | 文件系统读写。 |
| `hostApi.system` | `system` | 系统和应用信息。 |
| `hostApi.store` | `store` | 插件作用域 key-value 存储。 |
| `hostApi.http` | `http` | 通用 HTTP/HTTPS 请求。 |
| `hostApi.ws` | `websocket` | WebSocket 连接与消息收发。 |
| `hostApi.secrets` | `secrets` | 面向敏感凭据的插件级存储。通常会加密；必要时会回退到宿主可见的明文存储并提示。 |
| `hostApi.oauth` | `oauth` | 宿主管理 loopback 回调与 `state` 校验的 OAuth 授权辅助。 |
| `hostApi.jobs` | `jobs` | 宿主拥有的后台任务记录与协作式取消状态。 |
| `hostApi.locale` | `definitions` | 读取 FlexStudio 当前选择的界面语言。 |
| `hostApi.logger` | `logger` | 将日志写入宿主日志系统；通常优先使用 `this.logger`。 |
| `hostApi.plugin` | `definitions` / `store` / `pluginApi` | 插件定义注册、配置持久化与插件依赖调用 API。 |
| `hostApi.bus` | `bus` | 宿主事件总线。 |
| `hostApi.unit` | `unit` | Unit 设备事件。 |
| `hostApi.canvas` | `unit` | Canvas Unit 推帧。 |
| `hostApi.chart` | `chart` | 注册并发布插件自定义 Chart 性能/传感器数据源。 |
| `hostApi.ui` | `ui` | FlexStudio 主 UI 消息。 |
| `hostApi.device` | `device` | 连接设备配置和能力查询。 |
| `hostApi.electron.*` | 对应 `electron.*` | 受限 Electron 能力。 |

`hostApi.plugin.registerDependencyStateChannel()`、`publishDependencyState()`、`subscribeDependencyState()` 和 `unsubscribeDependencyState()` 构成 Dependency State Channel transport。Provider 注册、发布与 Consumer 订阅均需要各自 manifest 声明 `pluginApi`；unsubscribe 用于清理已有订阅，不要求额外权限。参数只传递 channel、JSON payload、subscription ID 和 options，handler 永远由 Consumer SDK 保留在本地进程。完整契约见 [插件依赖 API](./dependency-api.md#dependency-state-channel)。

`hostApi.plugin.registerRendererStateChannel(channel)` 与 `publishRendererState(channel, update)` 构成同插件 Renderer State Channel 的 Provider transport；前端桥接公开 `subscribeRendererState(channel, handler, { replayLatest })`。Provider 使用当前 `pluginApi` permission rule，capability registry 与契约测试必须使用相同规则。订阅只允许当前插件已认证的 renderer session；wire 上 renderer 不提供 plugin UUID 或 session identity。

Host 限制 payload 为 JSON object 且不超过 64 KiB，保留最新 snapshot/delta 状态，生成 epoch/revision，并按 subscription 串行投递。handler 完成或失败都会 ACK；失败、队列缺口或超限可要求 resync。iframe session 结束时 subscription 自动清理。

## File API

权限：`file`

```ts
interface PluginFileApi {
  readFile(filePath: string, encoding?: BufferEncoding): Promise<string | Buffer>
  writeFile(filePath: string, data: any, encoding?: BufferEncoding): Promise<void>
  exists(filePath: string): Promise<boolean>
  readDir(dirPath: string): Promise<string[]>
  mkdir(dirPath: string): Promise<void>
  unlink(filePath: string): Promise<void>
}
```

示例：

```ts
if (await this.hostApi.file.exists(path)) {
  const text = await this.hostApi.file.readFile(path, 'utf8')
  this.logger.info(String(text))
}
```

## System API

权限：`system`

```ts
interface PluginSystemApi {
  getPlatform(): Promise<string>
  getArch(): Promise<string>
  getCpuInfo(): Promise<any>
  getMemInfo(): Promise<any>
  getAppVersion(): Promise<string>
}
```

示例：

```ts
const [platform, arch, version] = await Promise.all([
  this.hostApi.system.getPlatform(),
  this.hostApi.system.getArch(),
  this.hostApi.system.getAppVersion(),
])
```

## Store API

权限：`store`

```ts
interface PluginStoreApi {
  get<T = any>(key: string, defaultValue?: T): Promise<T>
  set(key: string, value: any): Promise<void>
  delete(key: string): Promise<void>
  has(key: string): Promise<boolean>
}
```

示例：

```ts
const count = await this.hostApi.store.get('count', 0)
await this.hostApi.store.set('count', count + 1)
```

如果要保存插件配置，优先使用 `this.loadConfig()` 和 `this.saveConfig()`。

## Secrets API

权限：`secrets`

```ts
interface PluginSecretsApi {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  list(): Promise<Array<{ key: string; updatedAt: string; encrypted: boolean }>>
}
```

`hostApi.secrets` 适合保存 access token、refresh token、API key 等敏感凭据。数据按插件 UUID 隔离，其他插件无法直接读取。宿主负责加密存储与生命周期隔离，但不会替插件刷新令牌、校验令牌是否过期，也不会自动同步到插件配置。

写入时的加密策略：

- 在主流桌面环境里，FlexStudio 通常可通过 Electron `safeStorage` 使用系统提供的安全存储能力。
- 如果当前环境不支持加密，或写入时加密失败，FlexStudio 会把该插件作用域下的 secret 以明文形式写入自己的 secret store，并向用户显示一条简短 warning。
- `list()` 里的 `encrypted` 字段会反映当前记录是否真的加密保存。

读取时的安全策略：

- 对于真实的加密记录，如果解密失败，FlexStudio 会返回“没有这个值”，而不是把密文暴露给插件。
- 这通常意味着本机安全存储状态发生变化，插件应提示用户重新登录或重新保存 secret。

建议：

```ts
await this.hostApi.secrets.set('refresh-token', refreshToken)
const accessToken = await this.hostApi.secrets.get('access-token')
```

`list()` 只返回键名、更新时间和是否加密等元数据，不返回明文值。OAuth token、refresh token 和各类 API key 应优先保存在这里，而不是写入 `saveConfig()` 或 `hostApi.store` 的普通 JSON 配置。

## OAuth API

权限：`oauth`

```ts
interface OAuthAuthorizationRequest {
  authorizationUrl: string
  state: string
  callbackPath?: string
  timeoutMs?: number
}

interface OAuthAuthorizationResult {
  callbackUrl: string
  query: Record<string, string>
  code?: string
  state: string
}

interface PluginOAuthApi {
  startAuthorizationFlow(request: OAuthAuthorizationRequest): Promise<OAuthAuthorizationResult>
}
```

`hostApi.oauth.startAuthorizationFlow()` 会在本机 `127.0.0.1` 上启动一次性的 loopback listener，打开插件提供的授权页面，并在收到回调后把查询参数返回给插件。FlexStudio 会写入 loopback `redirect_uri`，校验回调中的 `state`，然后关闭监听器。宿主只负责授权阶段，不负责 token exchange、token 刷新和 token 持久化。

宿主职责：
- 将插件提供的 `state` 和 loopback `redirect_uri` 写入 provider 授权 URL。
- 在回调到达时校验 `state`，并把 `code`、`error` 及其他 query 参数原样返回给插件。
- 在成功、provider 错误、state 不匹配、超时、启动失败、打开浏览器失败或异常回调路径时关闭监听器。

插件职责：
- 自己构造 provider 授权 URL，并确保 `authorizationUrl` 使用 `http:` 或 `https:`，且 provider 已允许 loopback redirect URI。
- 收到 `code` 或 `error` 后自行完成 token exchange、错误处理和会话建立。
- 将 access token / refresh token 等敏感凭据保存到 `hostApi.secrets`。

Provider 配置注意事项：
- 只支持 loopback 回调，不支持自定义 URI scheme。
- `callbackPath` 应只用于区分本次回调路径，不应用来承载 token、code 或其他敏感数据。
- 如果 provider 不允许桌面客户端使用 loopback redirect URI，需要插件自行处理该 provider 的限制，而不是要求 FlexStudio 注册自定义协议。

示例：

```ts
const result = await this.hostApi.oauth.startAuthorizationFlow({
  authorizationUrl,
  state,
  timeoutMs: 120000,
})

if (result.query.error) {
  throw new Error(result.query.error)
}

await this.hostApi.secrets.set('oauth-refresh-token', refreshToken)
```

## Jobs API

权限：`jobs`

```ts
type PluginJobState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

interface PluginJobRecord {
  id: string
  pluginUUID: string
  title: string
  state: PluginJobState
  progress: number | null
  message?: string
  cancelRequested: boolean
  createdAt: string
  updatedAt: string
}

interface PluginJobCreateInput {
  title: string
  progress?: number | null
  message?: string
}

interface PluginJobUpdatePatch {
  title?: string
  progress?: number | null
  message?: string
}

interface PluginJobsApi {
  create(input: PluginJobCreateInput): Promise<PluginJobRecord>
  update(jobId: string, patch: PluginJobUpdatePatch): Promise<PluginJobRecord>
  complete(jobId: string, result?: unknown): Promise<PluginJobRecord>
  fail(jobId: string, error: string): Promise<PluginJobRecord>
  cancel(jobId: string): Promise<PluginJobRecord>
  get(jobId: string): Promise<PluginJobRecord | null>
  list(): Promise<PluginJobRecord[]>
  isCancellationRequested(jobId: string): Promise<boolean>
}
```

`hostApi.jobs` 适合长时同步、批量扫描、导入导出等后台任务。Job 记录由宿主持有，只保存在内存中，按插件 UUID 隔离；它们不是项目数据，也不会替代你的插件内部状态机。

状态约定：

- `create()` 创建 `queued` 记录。
- 第一次 `update()` 会把 `queued` 推进到 `running`。
- `complete()`、`fail()` 和 `cancel()` 会把 job 置为终态。

取消语义是协作式的：

1. 宿主或 UI 发起取消请求。
2. Job 记录的 `cancelRequested` 变为 `true`。
3. 插件在自己的长循环、分页同步或子任务边界轮询 `isCancellationRequested(jobId)`。
4. 插件完成清理后，显式调用 `jobs.cancel(jobId)`，把状态收敛到 `cancelled`。

也就是说，`jobs.cancel(jobId)` 不是“请求取消”，而是“插件确认自己已经清理完并结束这个 job”。

示例：

```ts
const job = await this.hostApi.jobs.create({
  title: 'Sync remote devices',
  progress: 0,
  message: 'Queued',
})

for (let page = 0; page < totalPages; page += 1) {
  if (await this.hostApi.jobs.isCancellationRequested(job.id)) {
    await cleanupPartialState()
    await this.hostApi.jobs.cancel(job.id)
    return
  }

  await syncOnePage(page)
  await this.hostApi.jobs.update(job.id, {
    progress: Math.round(((page + 1) / totalPages) * 100),
    message: `Synced page ${page + 1}/${totalPages}`,
  })
}

await this.hostApi.jobs.complete(job.id, { synced: true })
```

## HTTP API

权限：`http`

`hostApi.http` 是通用 Host API，不绑定 HomeAssistant 或任何特定服务。插件可以继续使用兼容的 `http.get()`，也可以使用通用的 `hostApi.http.request(options)` 发起 HTTP/HTTPS 请求。

```ts
interface PluginHttpApi {
  get(url: string, options?: any): Promise<{
    statusCode: number
    headers: Record<string, string | string[]>
    body: string
  }>

  request(options: PluginHttpRequestOptions): Promise<PluginHttpResponse>
}

type PluginHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type PluginHttpResponseType = 'text' | 'json' | 'arrayBuffer'

interface PluginHttpRequestOptions {
  url: string
  method?: PluginHttpMethod
  headers?: Record<string, string>
  body?: string | ArrayBuffer | Uint8Array | Record<string, any>
  responseType?: PluginHttpResponseType
  timeoutMs?: number
}

interface PluginHttpResponse<T = string | any | ArrayBuffer> {
  statusCode: number
  headers: Record<string, string | string[]>
  body: T
}
```

### `hostApi.http.get(url, options)`

`http.get()` 是旧版便捷方法，等价于发起 `GET` 请求并返回文本 `body`。已有插件可以继续使用。

```ts
const response = await this.hostApi.http.get('https://api.example.com/status')
if (response.statusCode === 200) {
  const data = JSON.parse(response.body)
}
```

### `hostApi.http.request(options)`

权限：`http`

`request()` 支持 `GET`、`POST`、`PUT`、`PATCH` 和 `DELETE`。`responseType` 可设为 `text`、`json` 或 `arrayBuffer`；未指定时默认按文本返回。Host 会拒绝非 `http:` / `https:` URL，并对请求应用超时和响应体大小限制，避免插件后端进程被无限等待或过大响应拖垮。

```ts
const response = await this.hostApi.http.request({
  url: 'https://api.example.com/widgets',
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: { name: 'Demo' },
  responseType: 'json',
  timeoutMs: 5000,
})

if (response.statusCode === 201) {
  this.logger.info('created widget', response.body)
}
```

返回值固定包含 `{ statusCode, headers, body }`。当 `responseType` 为 `json` 时，`body` 是解析后的 JSON；为 `arrayBuffer` 时，`body` 是二进制响应；为 `text` 时，`body` 是字符串。

## WebSocket API

权限：`websocket`

`hostApi.ws` 是通用 Host API，不绑定 HomeAssistant 或任何特定服务。插件可以通过 `hostApi.ws.connect(url, options)` 打开长连接 WebSocket。

```ts
interface PluginWebSocketApi {
  connect(url: string, options?: PluginWebSocketConnectOptions): Promise<PluginWebSocketHandle>
}

interface PluginWebSocketConnectOptions {
  headers?: Record<string, string>
  protocols?: string | string[]
  timeoutMs?: number
}

interface PluginWebSocketHandle {
  send(data: string | ArrayBuffer | Uint8Array): Promise<void>
  close(code?: number, reason?: string): Promise<void>
  on(event: 'message', handler: (event: { data: string | ArrayBuffer }) => void): () => void
  on(event: 'error', handler: (event: { message: string }) => void): () => void
  on(event: 'close', handler: (event: { code: number; reason: string }) => void): () => void
  off(event: 'message', handler: (event: { data: string | ArrayBuffer }) => void): void
  off(event: 'error', handler: (event: { message: string }) => void): void
  off(event: 'close', handler: (event: { code: number; reason: string }) => void): void
}
```

示例：

```ts
const socket = await this.hostApi.ws.connect('wss://stream.example.com/events')

const unsubscribe = socket.on('message', async (message) => {
  this.logger.info('ws message', { message })
})

await socket.send(JSON.stringify({ type: 'subscribe', topic: 'metrics' }))

// 不再需要监听时先取消订阅，再关闭连接。
unsubscribe()
await socket.close(1000, 'plugin shutdown')
```

插件应在 `onUnload()` 中主动调用 `close()` 清理自己打开的 sockets。插件 unload、disable、reload、crash 或进程 exit 时，Host 也会关闭该插件 owned sockets，避免连接泄漏。
## Logger API

权限：`logger`

```ts
interface PluginLoggerHostApi {
  log(level: string, message: string, data?: any): Promise<void>
}
```

通常优先使用 `this.logger.debug/info/warn/error()`。只有在需要直接访问 host logger proxy 时再使用 `hostApi.logger.log()`。

## Plugin API

权限：`definitions`、`store` 或 `pluginApi`

```ts
interface PluginHostApi {
  registerDefinitions(payload: PluginDefinitionsPayload): Promise<void>
  loadConfig<T extends Record<string, any> = Record<string, any>>(defaults?: T): Promise<T>
  saveConfig(config: Record<string, any>): Promise<void>
  callDependency<T = any>(
    dependencyUUID: string,
    method: string,
    params?: any[],
  ): Promise<T>
}
```

权限要求：

| 方法 | 权限 | 说明 |
| --- | --- | --- |
| `registerDefinitions` | `definitions` | 替换当前插件注册的 Library 与 Unit 定义。 |
| `loadConfig` | `store` | 读取插件配置。不存在时返回默认值或空对象。 |
| `saveConfig` | `store` | 原子写入插件配置。 |
| `callDependency` | `pluginApi` | 调用 manifest 中声明的直接依赖插件暴露的后端 API。 |

`FlexPluginBase` 提供了同名便捷方法：

```ts
const config = await this.loadConfig({ enabled: true })
await this.saveConfig(config)
await this.registerDefinitions(payload)
```

`callDependency()` 用于插件后端之间的请求/响应式调用。调用方必须声明 `pluginApi` 权限，并且目标插件必须是 manifest 中声明的直接依赖：

```ts
const result = await this.hostApi.plugin.callDependency(
  '@acme/base-plugin',
  'getStatus',
  ['device'],
)
```

通过 `FlexPluginBase` 调用 `callDependency()` 时，缺失、未启用、未加载、未找到或未声明为直接依赖的目标插件默认会触发
`reason: "missingDependency"` 的 fatal 上报并终止当前插件后端进程。只有插件明确支持缺少依赖时的降级模式时，才应调用
`this.setMissingDependencyAutoTerminate(false)` 显式禁用该策略。

更多设计约束、暴露方式和错误语义见 [插件依赖 API](./dependency-api.md)。

## Bus API

权限：`bus`

```ts
interface PluginBusApi {
  on(topic: string, options?: RegisterEventOptions): Promise<void>
  off(topic: string, handler: PluginEventHandler): Promise<void>
}

interface RegisterEventOptions {
  snapshot?: boolean
}
```

建议通过 `FlexPluginBase.on()`、`off()`、`once()` 使用，因为基类会保存本地 handler 并处理事件分发。

Topic 约定：

| Topic | 说明 |
| --- | --- |
| `device.connection.changed` | 设备连接状态变化。 |
| `device.connection.snapshot` | 当前设备连接状态快照。 |
| `device.plugin.<typeId>.pressed` | 插件 Unit 被按下。 |
| `device.plugin.<typeId>.released` | 插件 Unit 被释放。 |
| `device.plugin.<typeId>.touch` | 插件 Unit 触摸事件。 |
| `device.plugin.<typeId>.load` | 插件 Unit 在设备上加载或可见。 |
| `device.plugin.<typeId>.unload` | 插件 Unit 在设备上卸载或隐藏。 |

## Unit API

权限：`unit`

```ts
type UnitDeviceEventType = 'load' | 'unload' | 'touch' | 'pressed' | 'released' | 'changed'
type DeviceUnitRuntimeStatus = 'enabled' | 'disabled' | 'warning' | 'loading'

interface PluginUnitApi {
  on(typeId: string, event: UnitDeviceEventType, options?: RegisterEventOptions): Promise<void>
  off(typeId: string, event: UnitDeviceEventType, handler: PluginEventHandler): Promise<void>
  setRuntimeStatus(serialNumber: string, unitUuid: string, status: DeviceUnitRuntimeStatus): Promise<void>
  setFunction(serialNumber: string, unitUuid: string, functionId: string): Promise<void>
  getButtonGroupState(serialNumber: string, unitUuid: string): Promise<string[]>
  setButtonGroupState(serialNumber: string, unitUuid: string, activeButtonIds: string[]): Promise<void>
  setSliderValue(serialNumber: string, unitUuid: string, value: number): Promise<void>
  setValueLabelData(serialNumber: string, unitUuid: string, value: number | string): Promise<void>
  setLabelText(serialNumber: string, unitUuid: string, text: string): Promise<void>
  setUnitIcon(serialNumber: string, unitUuid: string, icon: string | number): Promise<void>
}
```

建议使用 `FlexPluginBase.onUnitEvent()` 和 `offUnitEvent()`：

```ts
await this.onUnitEvent('acme.open-url', 'pressed', async (event) => {
  this.logger.info('pressed', event.payload)
})
```

## Chart API

权限：`chart`

`hostApi.chart` 用于把插件的数值与状态数据接入内置 Chart 和插件 Chart 共用的数据树。实时数据只保存在 host runtime cache 中，不写入项目文件或 `defaultData`；插件禁用、卸载、进程退出或崩溃时，宿主会清理该插件注册的数据源和 entries。

`registerDataSource()` 以插件为所有者注册或替换一个数据源。每个插件最多 16 个数据源；`sourceId` 是插件内本地 ID，长度 1-80，只允许字母、数字、`.`、`_`、`-`。`name` 长度 1-80，`icon` 长度 1-80。宿主生成全局 provider id，插件不能指定或覆盖 provider metadata。

`publishEntries()` 每次发布的是整个 data source 的快照，不是增量 patch；同一 source 最多 256 个 entries。entry 的 `key` 是插件内本地 key，长度 1-120，规则同 `sourceId`，同一 source 内区分大小写且必须唯一。宿主生成全局 entry key，插件不能提供 `providerId`、`providerName`、`providerKind`、`ownerPluginUUID`、`localKey`、`category`、`subCategory`、`formattedValue`、`historyValues` 或 `maxLength` 等宿主字段。

调用频率按 source 限流：同一 source 最小处理间隔为 250ms。间隔内的多次发布只保留最新 pending 快照；renderer 更新另有约 100ms debounce，并会推送当前完整 flat entries payload。

`groupPath` 支持多级分组，最大深度 6，每段长度 1-80；Chart 选择器会显示为 `Plugins -> 数据源 -> groupPath... -> entry`。如果某个选择器启用 plugin-only 模式，会隐藏 `Plugins` 顶层，直接从数据源开始显示。

`type` 决定默认格式化和图标；`unit`、`precision`、`min`、`max` 可覆盖显示单位、精度和量程。`name` 长度 1-100，`unit` 长度 1-16，`precision` 必须是 0-6 的整数；`min`/`max` 必须同时提供，且为有限数字并满足 `min < max`。插件提供 `unit` 时，`rawValue`、`min`、`max` 都按该显示单位解释。

`formattedValue` 和历史值由宿主维护，插件只发布当前 `rawValue`。

```ts
type PluginChartSensorType =
  | 'Clock'
  | 'Temperature'
  | 'Power'
  | 'Voltage'
  | 'Load'
  | 'Fan'
  | 'Throughput'
  | 'Data'
  | 'SmallData'
  | 'Level'
  | 'Control'
  | 'Factor'

interface PluginChartDataSourceOptions {
  sourceId: string
  name: string
  icon?: string
}

interface PluginChartEntryInput {
  key: string
  name: string
  type: PluginChartSensorType
  rawValue: number
  groupPath?: string[]
  icon?: string
  unit?: string
  precision?: number
  min?: number
  max?: number
}

interface PluginChartApi {
  registerDataSource(options: PluginChartDataSourceOptions): Promise<void>
  unregisterDataSource(sourceId: string): Promise<void>
  publishEntries(sourceId: string, entries: PluginChartEntryInput[]): Promise<void>
}
```

示例：

```ts
await this.hostApi.chart.registerDataSource({
  sourceId: 'home-assistant',
  name: 'Home Assistant',
  icon: 'mdi-home-thermometer',
})

await this.hostApi.chart.publishEntries('home-assistant', [
  {
    key: 'living-room.temperature',
    name: 'Living Room Temperature',
    type: 'Temperature',
    rawValue: 23.4,
    groupPath: ['Living Room', 'Climate'],
    icon: 'mdi-thermometer',
    unit: '°C',
    precision: 1,
    min: 0,
    max: 40,
  },
])

await this.hostApi.chart.unregisterDataSource('home-assistant')
```

## Canvas API

权限：`unit`

```ts
interface PluginCanvasApi {
  pushFrame(serialNumber: string, uuid: string, pngBuffer: Buffer): Promise<void>
}
```

`pushFrame()` 用于 Canvas Unit。参数：

| 参数 | 说明 |
| --- | --- |
| `serialNumber` | 目标设备序列号，来自 `load` 事件。 |
| `uuid` | Unit 实例 UUID，来自 `load` 事件。 |
| `pngBuffer` | PNG 编码图像 Buffer。 |

宿主会自动缩放尺寸并编码为 JPEG 发送到设备。超过每个 Unit 60fps 的帧会被丢弃。

## UI API

权限：`ui`

```ts
type SnackbarMessageType = 'success' | 'error' | 'warning' | 'info'

interface SnackbarMessageOptions {
  message: string
  type?: SnackbarMessageType
  duration?: number
}

interface PluginUiApi {
  showSnackbarMessage(options: SnackbarMessageOptions): Promise<void>
}
```

示例：

```ts
await this.hostApi.ui.showSnackbarMessage({
  message: 'Export complete',
  type: 'success',
  duration: 3000,
})
```

## Locale API

权限：`definitions`

```ts
const locale = await this.hostApi.locale.getCurrent()
```

返回 FlexStudio 当前选择的界面语言代码。插件应用它选择本地化文本，并在需要时通过 `plugin-i18n` 辅助方法处理回退。

## Device API

权限：`device`

```ts
interface PluginDeviceConfig {
  deviceName: string
  color: number
  sleepTimeout: number
  brightness: number
  screenFlip: boolean
  vibrate: number
  autoSleep: boolean
}

interface PluginDeviceApi {
  getDeviceConfig(serialNumber: string): Promise<PluginDeviceConfig>
  setDeviceConfig(serialNumber: string, patch: Partial<PluginDeviceConfig>): Promise<void>
  showSnackbarMessage(serialNumber: string, options: DeviceSnackbarMessageOptions): Promise<void>
  getModel(serialNumber: string): Promise<string>
  getScreenSize(serialNumber: string): Promise<{ width: number; height: number }>
  getCapabilities(serialNumber: string): Promise<DeviceCapability[]>
  hasCapability(serialNumber: string, capability: DeviceCapability): Promise<boolean>
}
```

设备 snackbar 参数：

```ts
interface DeviceSnackbarMessageOptions {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  iconUnicode?: string
}
```

示例：

```ts
const size = await this.hostApi.device.getScreenSize(serialNumber)
const hasTouch = await this.hostApi.device.hasCapability(serialNumber, 'touchscreen')
await this.hostApi.device.showSnackbarMessage(serialNumber, {
  message: 'Updated',
  type: 'success',
})
```

## Electron API

Electron API 通过 `hostApi.electron.*` 暴露。每个子模块需要单独权限。

### electron.app

权限：`electron.app`

```ts
interface PluginElectronAppApi {
  getPath(name: string): Promise<string>
  getAppPath(): Promise<string>
  getName(): Promise<string>
  getVersion(): Promise<string>
  getLocale(): Promise<string>
  isPackaged(): Promise<boolean>
}
```

### electron.browserWindow

权限：`electron.browserWindow`

```ts
interface PluginElectronBrowserWindowApi {
  getBounds(): Promise<ElectronRectangle>
  setBounds(bounds: Partial<ElectronRectangle>): Promise<void>
  minimize(): Promise<void>
  maximize(): Promise<void>
  unmaximize(): Promise<void>
  restore(): Promise<void>
  show(): Promise<void>
  hide(): Promise<void>
  focus(): Promise<void>
  isVisible(): Promise<boolean>
  isFocused(): Promise<boolean>
  isMinimized(): Promise<boolean>
  isMaximized(): Promise<boolean>
}
```

### electron.clipboard

权限：`electron.clipboard`

```ts
interface PluginElectronClipboardApi {
  readText(type?: 'selection' | 'clipboard'): Promise<string>
  writeText(text: string, type?: 'selection' | 'clipboard'): Promise<void>
  readHTML(type?: 'selection' | 'clipboard'): Promise<string>
  writeHTML(markup: string, type?: 'selection' | 'clipboard'): Promise<void>
  readImage(): Promise<ElectronNativeImagePng | null>
  writeImage(image: ElectronNativeImagePng): Promise<void>
  clear(): Promise<void>
}
```

### electron.globalShortcut

权限：`electron.globalShortcut`

```ts
interface PluginElectronGlobalShortcutApi {
  register(accelerator: string): Promise<void>
  unregister(accelerator: string): Promise<void>
  isRegistered(accelerator: string): Promise<boolean>
}
```

### electron.powerMonitor

权限：`electron.powerMonitor`

```ts
interface PluginElectronPowerMonitorApi {
  getSystemIdleTime(): Promise<number>
  getSystemIdleState(idleThreshold: number): Promise<'active' | 'idle' | 'locked' | 'unknown'>
}
```

### electron.dialog

权限：`electron.dialog`

```ts
interface PluginElectronDialogApi {
  showOpenDialog(options?: ElectronOpenDialogOptionsDto): Promise<ElectronOpenDialogResultDto>
  showSaveDialog(options?: ElectronSaveDialogOptionsDto): Promise<ElectronSaveDialogResultDto>
  showMessageBox(options: ElectronMessageBoxOptionsDto): Promise<ElectronMessageBoxResultDto>
}
```

### electron.pushNotifications

权限：`electron.pushNotifications`

```ts
interface PluginElectronPushNotificationsApi {
  registerForAPNSNotifications(): Promise<{ success: boolean; error?: string }>
  unregisterForAPNSNotifications(): Promise<void>
}
```

### electron.screen

权限：`electron.screen`

```ts
interface PluginElectronScreenApi {
  getCursorScreenPoint(): Promise<{ x: number; y: number }>
  getPrimaryDisplay(): Promise<ElectronDisplayDto>
  getAllDisplays(): Promise<ElectronDisplayDto[]>
  getDisplayNearestPoint(point: { x: number; y: number }): Promise<ElectronDisplayDto>
}
```

## 最小权限建议

常见插件类型的起始权限：

| 插件类型 | 建议权限 |
| --- | --- |
| 只注册 Unit，无额外逻辑 | `definitions` |
| 有编辑器并保存插件配置 | `definitions`, `store`, `ui` |
| 监听 Unit 按键或触摸事件 | `definitions`, `unit`, `logger` |
| Canvas Unit | `definitions`, `unit`, `logger` |
| 发布 Chart 数据源 | `chart`, `logger`；如果数据来自网络、系统或文件，再追加 `http`、`system` 或 `file`；只有同时注册 Unit 时才需要 `definitions` |
| 调用网络 API | `definitions`, `http`, `store`, `logger` |
| 读写本地文件 | `definitions`, `file`, `logger` |
| 访问剪贴板 | `definitions`, `electron.clipboard`, `ui` |

<!-- plugin-cycled-slider:start -->
## Plugin Unit Runtime API

`hostApi.unit` 需要 `unit` 权限。权威接口见上方 Unit API；本节补充通用 runtime status，以及 plugin `cycled`、`button-group`、`slider`、`value-label` 和 `label` 的运行时语义。

### 通用 Unit runtime status

`setRuntimeStatus()` 可为当前插件拥有、且已加载到目标设备的 plugin Unit 设置运行时状态。状态只保存在设备内存中；切换 page 不丢失，project sync / reload 或设备重启会清空。

- `enabled`：默认状态，清除额外视觉状态并恢复交互。
- `disabled`：设备端显示黑色 mask 和 `mdi-cancel`，并阻断该 Unit 的设备端交互。
- `warning`：设备端左上角显示黄色 `mdi-alert-circle` 角标，不阻断交互。
- `loading`：设备端显示居中的 loading spinner，并阻断该 Unit 的设备交互；适合短时异步动作。动作完成后插件必须显式恢复为 `enabled`、`warning` 或 `disabled`。

```ts
const serialNumber = event.payload.serialNumber?.trim()
if (!serialNumber) {
  throw new Error('Device serial number is required')
}
const unitUuid = event.payload.uuid

await this.hostApi.unit.setRuntimeStatus(serialNumber, unitUuid, 'loading')
let finalStatus: DeviceUnitRuntimeStatus = 'warning'
try {
  await runAction()
  finalStatus = 'enabled'
  void this.hostApi.device.showSnackbarMessage(serialNumber, {
    message: 'Action completed',
    type: 'success',
  }).catch(() => undefined)
} catch (error) {
  void this.hostApi.device.showSnackbarMessage(serialNumber, {
    message: 'Action failed',
    type: 'error',
  }).catch(() => undefined)
  throw error
} finally {
  await this.hostApi.unit.setRuntimeStatus(serialNumber, unitUuid, finalStatus)
}
```

插件只能设置自己的已加载 plugin Unit；不能设置内置 Unit、其它插件的 Unit，或当前未加载的 Unit。FlexStudio 主程序内部 API 可设置当前映射项目中的任意 Unit。

### cycled 状态更新

`setFunction()` 只接受 `functionId`，不接受 function index。宿主会校验该 Unit 属于当前插件、类型是 `cycled`、`functionId` 存在，然后把新状态发布到目标设备。

```ts
await this.hostApi.unit.setFunction(
  event.payload.serialNumber,
  event.payload.uuid,
  'pause',
)
```

设备点击 plugin `cycled` Unit 时，宿主不会自行切换状态。插件应在业务动作成功后调用 `setFunction()`；失败时调用设备通知 API，例如：

```ts
await this.hostApi.device.showSnackbarMessage(event.payload.serialNumber, {
  message: 'Unable to control player',
  type: 'error',
})
```

### 指示灯与宿主绘制

`hostApi.unit.setFunction(...)` 改变 plugin `cycled` Unit 当前函数时，已声明的 `indicator.onFunctionIds` 控制宿主指示灯。按钮组使用共享原生 Button 指示灯，由确认的选中状态驱动；插件无需额外更新外观来画灯。

### button-group 状态更新

`getButtonGroupState()` 返回当前激活按钮 ID 列表。`setButtonGroupState()` 会按注册定义校验 `selectionMode`、`mandatory` 和按钮 ID，再把规范化后的状态发布到目标设备并写入 runtime slot。

```ts
const activeButtonIds = await this.hostApi.unit.getButtonGroupState(
  event.payload.serialNumber,
  event.payload.uuid,
)

await this.hostApi.unit.setButtonGroupState(
  event.payload.serialNumber,
  event.payload.uuid,
  ['hdmi'],
)
```

Button Group `changed` 事件 payload 包含：

```ts
interface PluginButtonGroupChangedEventPayload {
  serialNumber: string
  uuid: string
  typeId: string
  pluginUUID: string
  selectionMode: 'single' | 'multiple'
  mandatory: boolean
  activeButtonIds: string[]
  previousActiveButtonIds: string[]
  changedButtonId?: string
  changedButtonIndex?: number
  buttons: Array<{
    buttonId: string
    index: number
    name?: string
    data?: Record<string, any>
  }>
  source: 'device' | 'api' | 'load'
}
```

宿主会根据注册定义重新校验和规范化设备上报的 Button Group 状态，再转发给拥有该 Unit 的插件。`buttons[].data` 来自插件定义或用户在函数编辑器中保存的业务数据，不包含按钮外观。

规则：

- 该 API 只作用于属于当前插件、定义类型为 `button-group`，且已加载到目标设备或可从该设备映射项目恢复 runtime slot 的 Unit。
- `single` 模式最多一个激活按钮；`multiple` 模式允许多个激活按钮。
- `mandatory: true` 时，空激活列表会被拒绝或恢复为定义允许的默认激活按钮。
- 未知按钮 ID、重复 ID、空字符串或不满足选择模式的输入会被拒绝。
- 监听状态变化使用 `hostApi.unit.on(typeId, 'changed')` 或 `FlexPluginBase.onUnitEvent(typeId, 'changed', handler)`。

### slider 值更新

`setSliderValue()` 会按该 Unit 注册的 `min`、`max`、`step` 和 `format` 夹取、量化、格式化，然后发布到设备。

```ts
await this.hostApi.unit.setSliderValue(
  event.payload.serialNumber,
  event.payload.uuid,
  42.5,
)
```

Slider `changed` 事件 payload 包含：

```ts
interface PluginSliderChangedEventPayload {
  serialNumber: string
  uuid: string
  typeId: string
  value: number
  phase: 'preview' | 'commit'
  min: number
  max: number
  step: number
  format: string
  displayText: string
  data?: Record<string, any>
}
```

宿主会根据注册定义重新校验和规范化设备上报值，再转发给拥有该 Unit 的插件。不要通过原始 `device.plugin.*` wildcard 监听其它插件的 Unit 事件；插件 Unit 事件按 owner 隔离，推荐始终使用 `hostApi.unit.on()` 或 `FlexPluginBase` helper。

### value-label 数据更新

`setValueLabelData()` 只作用于属于当前插件、定义类型为 `value-label`，且已加载到目标设备或可从该设备映射项目恢复 runtime slot 的 Unit。宿主会使用注册定义里的 `valueLabel` 配置生成最终显示文本，并发布给目标设备。

```ts
await this.hostApi.unit.setValueLabelData(
  event.payload.serialNumber,
  event.payload.uuid,
  23.5,
)
```

规则：

- `format` 模式只接受有限 `number`，并按注册的 `format` 生成 `displayText`。
- `custom` 模式接受 `number | string`，不会检查运行时文本是否都存在于声明的字体子集中；缺失字符由设备端显示为方框。
- 该 API 要求 `unit` 权限，并要求目标 Unit 已加载到指定设备，或可从该设备映射的项目中恢复宿主渲染 slot。
- `value-label` 不产生设备端 `changed` 事件；插件需要主动调用该 API 更新显示。

### label 文本更新

`setLabelText()` 只作用于属于当前插件、定义类型为 `label`，且已加载到目标设备或可从该设备映射项目恢复 runtime slot 的 Unit。文本必须是字符串，Unicode 内容会原样发送给设备，由设备端用定义里的 `fontFamily` 渲染。

```ts
await this.hostApi.unit.setLabelText(
  event.payload.serialNumber,
  event.payload.uuid,
  '在线',
)
```

`label` 不产生设备端 `changed` 事件；插件需要主动调用该 API 更新显示。

### runtime 主图标更新

`setUnitIcon()` 只作用于属于当前插件、定义类型为 `value-label` 或 `label`，且已加载到目标设备或可从该设备映射项目恢复 runtime slot 的 Unit。宿主会把输入标准化为 MDI codepoint payload，再发布给设备端用 MDI 字体绘制 primary icon。

```ts
await this.hostApi.unit.setUnitIcon(
  event.payload.serialNumber,
  event.payload.uuid,
  'mdi-volume-up',
)
```

支持的图标输入：

- MDI 名称：`mdi-volume-up` 或 `volume-up`。
- 数字 codepoint：`0xe050`。
- 字符串 codepoint：`0xE050`、`U+E050`。
- 私有区单字符，或私有区裸十六进制，例如 `E050`。

未知 MDI 名称、空字符串、代理区 codepoint、越界 codepoint 会被拒绝。裸十六进制只有在落入 Unicode 私有区时才按 codepoint 解析，否则按未知 MDI 名称处理。
<!-- plugin-cycled-slider:end -->

OAuth loopback flow 默认等待 120 秒，`timeoutMs` 最大为 10 分钟。插件进程的 OAuth Host API 等待窗口使用同一上限并增加 5 秒用于宿主清理和 IPC 响应；普通 Host API 调用仍为 30 秒。前端不要等待完整授权过程的 backend RPC：启动后台任务后及时返回，再通过 Renderer State Channel 汇报授权结果。Brokered OAuth 仍属于设计提案，当前实现没有该 API。

## 原生 panel 与 Unit 状态

以下方法都需要 manifest 的 unit 权限。Host 从插件进程身份确定所有者，只接受同插件、已加载的正确类型 Unit。

```ts
const bindings = await this.hostApi.unit.getPanelBindings(serialNumber, unitUuid)
await this.hostApi.unit.setPanelModel(serialNumber, unitUuid, model)
await this.hostApi.unit.sendPanelInput(serialNumber, unitUuid, {kind:'rotate', delta:1})
await this.hostApi.unit.ackPanelAction(
  serialNumber, unitUuid, token, 'ok', // ok | expired | failed | unknown
  'Done',
)
await this.hostApi.unit.setUnitState(serialNumber, labelUuid, 'attention')
```

setPanelModel 接收 AgentPanelModel 业务数据；navigation 与 item.slot 被拒绝，宿主绑定固定目标并生成设备 PanelModel v1。getPanelBindings 返回只读的元素绑定快照；sendPanelInput 将相对输入直接按序送到原生 UI，不经过最新模型合并队列。setPanelModel 先校验再复制模型，调用者后续修改不影响待发数据。每台设备只允许一个推送在途，各 Unit 只保留最新一份；USB 最多 4 次/秒，RF 最多 1 次/秒。新增 attention 状态可提前发送，但仍遵守设备单在途。卸载插件、删除 Unit 和设备断开会清理队列与相关状态。

ackPanelAction 的 token 必须来自设备 action 事件。message 可选，最多 240 UTF-8 字节，回执整体最多 1024 字节；不要发送提示词、命令全文或原始异常。回执通过异步 BUS 发给设备，不调用设备 UI 线程上的超时 RPC。过期或不匹配 token 由设备忽略。

setUnitState 仅适用于 label/value-label，state 为 idle/active/attention/success/error/disabled。panel 条目的状态通过模型提供，不调用此 API。label/value-label 点按由插件处理，设备跳页使用独立 PageJump Unit。

### Chart 数据可用性与时间显示（SDK 2.2）

`PluginChartEntryInput` 增加 `availability?: 'available' | 'unavailable' | 'stale' | 'offline'`（省略为 available）以及 `displayText?: string`。后者用于数值/时间格式，例如 `2h 15m`、`10/13 18:30`，限 1–80 字符，仅允许数字、空格和 `:./%+eEhm ds-`，不是任意业务文案。Chart 原生字体覆盖该字符集。图表仍使用 rawValue 计算，displayText 只覆盖显示字符串。

不可用数据仍提交有限 rawValue，但渲染器忽略该值并显示 `--`，不画 0% 或保留旧圆环。图表数据源注销或完整快照缺少已订阅 key 也应清空旧数据。不要把未知值、断连或过期状态编码成真实零值。共享数据源面向内置 Chart 与插件 Chart，只有 Unit 的创建定义和生命周期归属不同。

## 设备输入功能

物理控件绑定使用 `defineFunction` / `FlexPluginBase.functions`，独立于 Unit 定义。声明 `input` 权限；复杂设置使用 `input-function-settings` 和绑定会话桥接，反馈通过当前上下文，状态按设备与绑定隔离。完整生命周期、字段、触觉和验证要求见[输入功能](./input-functions.md)。

## Composite Runtime API

权限为 `unit`。后端在 `await super.onLoad(ctx)` 后使用 `this.compositeElements`。它封装 `hostApi.unit.composite` 的结构化结果、订阅握手和本地缓冲；不要绕过 SDK 直接监听 `device.plugin.composite`。目标必须属于当前插件，并由设备现有 `load` 通知提供 `{ serialNumber, unitUuid: payload.uuid, generation: payload.generation }`。禁止由编辑稿 UUID 或旧缓存猜测 generation。

```ts
interface CompositeRuntimeTargetV1 {
  serialNumber: string
  unitUuid: string
  generation: string
}
// 以下方法都位于 this.compositeElements，省略的类型从 @flexsdk/types 导出。
interface CompositeElementApi {
  getSnapshot(target: CompositeRuntimeTargetV1, options: CompositeRuntimeSnapshotOptionsV1): Promise<CompositeRuntimeHostSnapshotV1>
  applyTransaction(target: CompositeRuntimeTargetV1, transaction: CompositeRuntimeHostTransactionV1): Promise<CompositeRuntimeCommitV1>
  subscribe(target: CompositeRuntimeTargetV1, options: CompositeRuntimeSubscriptionOptionsV1, handler?: CompositeElementHandler): Promise<CompositeElementSubscription>
  getButtonConfigs(target: CompositeRuntimeTargetV1): Promise<CompositeRuntimeButtonConfigsV1>
  setText(target: CompositeRuntimeTargetV1, elementUuid: string, text: string): Promise<CompositeRuntimeCommitV1>
  setIcon(target: CompositeRuntimeTargetV1, elementUuid: string, icon: string): Promise<CompositeRuntimeCommitV1>
  hide(target: CompositeRuntimeTargetV1, elementUuid: string): Promise<CompositeRuntimeCommitV1>
}
```

`getSnapshot(target, { view })` 每次都向设备读取，返回 `{ target, snapshot }`；宿主不保留设备状态副本，离线时报 `OFFLINE`。`snapshot` 包含 `view`、`revision`、`eventSequence`、`presented`、`pluginOnline`、`elements: [{ element, origin, overriddenFields }]` 和 `states: { [buttonUuid]: { stateId, pendingRequestId? } }`。`deployed` 读取实际部署保存结构，`effective` 包含运行时修改。

| operation | 字段与语义 |
| --- | --- |
| `create` | `{ op: 'create', index, element }`；element 不含 UUID，宿主为每个新元素随机生成 UUID（重试同一请求会得到新的 UUID，用 identifier 在返回的快照中定位）。只允许原生 Button/Text/Icon/Image。 |
| `patch` | `{ op: 'patch', elementUuid, changes: { 'data.text': '25' } }`；keys 是契约内的精确路径，不是任意递归合并。 |
| `remove` | `{ op: 'remove', elementUuid }`；只能删除本代次运行时创建的元素。 |
| `setState` | `{ op: 'setState', elementUuid, outcome: 'confirmed', stateId, requestId? }`，或 `{ op: 'setState', elementUuid, outcome: 'failed', requestId }`。这里的 requestId 是原 Button 业务请求 ID。 |
| `resetOverrides` | `{ op: 'resetOverrides', scope: 'fields', elementUuid, paths }`、`{ op: 'resetOverrides', scope: 'element', elementUuid }` 或 `{ op: 'resetOverrides', scope: 'instance' }`。 |

保存元素不能删除、重排或改变身份；运行时元素可以创建、删除和改变允许的几何字段。模式 `data.interaction.mode` 和 `data.initialStateId` 在创建时固定。整体替换 interaction 必须保留 mode；省略可选长按／连发字段可关闭手势。不用 null 删除字段。状态定义可改，但最终候选必须保留初始、确认和 pending 状态的有效引用。Text/Button 字符串、字体档位、图标与已部署 Image 资源遵循定义准入。

事务按顺序建立候选列表，最终验证与设备应用成功后才发布。返回 `{ committed: true, revision, eventSequence, presented, snapshot }` 表示设备已提交；`presented: false` 表示当前未显示，不能解释为失败。`setText`、`setIcon`、`hide` 也走同一事务。

`applyTransaction(target, { expectedRevision?, operations })` 没有事务请求 ID，也没有幂等记录；`setState` 里的 requestId 只表示原 Button 业务请求。事务已发出但超时、传输中断或设备断连时一律报 `RESULT_UNKNOWN`，宿主不查询也不重发；插件必须重新读取 `effective` 快照确认结果后再决定是否重做。只有从未发出的排队过期事务报 `TIMEOUT`。多个写入者需要比较并发版本时传 `expectedRevision`。`getButtonConfigs` 只读取与已确认部署源和 generation 绑定的主机私有配置，不下发设备、不回退编辑稿；记录缺失时报 `CACHE_MISS`。

订阅返回 `{ snapshot, on(handler), dispose(), closed }`。handler 接收 `snapshot`（reason 为 initial/gap）、`event`、`offline`、`retired`、`error` delivery。事件类型为 `press/release/activate/longPress/repeat/cancel/stateChanged`，包含 target、path、sequence、revision、interactionId、source、timeMs，按需包含 requestId、stateId、repeatIndex。只有 activate/longPress/repeat 等明确业务事件执行动作；API 引起的 stateChanged 只同步。SDK 先装缓冲再向宿主订阅；收到快照并 ACK 后才使设备触摸上线。缺口以新快照修复，不补播旧点击。设备通知 `pluginOnline` 是单向消息，没有应答。

隐藏页面保留本代次有效状态并取消按压；重部署或设备重启换 generation，旧消息被拒绝。插件离线时保留最后确认显示并禁止业务触摸。重连重新获取确认快照并订阅，不排队重放点击。实例不再使用时调用 dispose；`closed` 在释放时解析为 null，在终止失败时解析为结构化错误。

`CompositeElementError` 提供 `code`、`detail: { code, phase, operationIndex?, elementUuid?, path?, message? }` 。常见代码为 `CAPABILITY_UNSUPPORTED`、`OWNER_MISMATCH`、`STALE_GENERATION`、`OFFLINE`、`CACHE_MISS`、`REVISION_CONFLICT`、`NOT_WRITABLE`、`RESOURCE_NOT_DEPLOYED`、`LIMIT_EXCEEDED`、`DEVICE_APPLY_FAILED`、`TIMEOUT`、`RESULT_UNKNOWN`。宿主与固件都需支持 Composite v1；旧宿主／旧设备明确拒绝，不回退 canvas。

当前预算由 SDK `COMPOSITE_RUNTIME_LIMITS_V1` 生成：64 个元素、32 个运行时元素、32 个 Button、64 个操作、事务 32768 UTF-8 字节、整消息 61440 字节、文字 2048 UTF-8 字节、32 个待处理请求／排队请求、单 Unit 16 个订阅、128 条缓冲 delivery、全局队列 128 KiB。值在两型号性能验收前为暂定，超限明确拒绝；插件不得依赖未公布的更大容量。
