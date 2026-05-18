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
| `hostApi.http` | `http` | HTTP 请求。 |
| `hostApi.logger` | `logger` | 低层日志写入。通常优先使用 `this.logger`。 |
| `hostApi.plugin` | `definitions` / `store` / `pluginApi` | 插件定义注册、配置读写和直接依赖 API 调用。 |
| `hostApi.bus` | `bus` | 宿主事件总线。 |
| `hostApi.unit` | `unit` | Unit 设备事件。 |
| `hostApi.canvas` | `unit` | Canvas Unit 推帧。 |
| `hostApi.chart` | `chart` | 注册并发布插件自定义 Chart 性能/传感器数据源。 |
| `hostApi.ui` | `ui` | FlexStudio 主 UI 消息。 |
| `hostApi.device` | `device` | 连接设备配置和能力查询。 |
| `hostApi.electron.*` | 对应 `electron.*` | 受限 Electron 能力。 |

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

## HTTP API

权限：`http`

```ts
interface PluginHttpApi {
  get(url: string, options?: any): Promise<{
    statusCode: number
    headers: any
    body: string
  }>
}
```

示例：

```ts
const response = await this.hostApi.http.get('https://api.example.com/status')
if (response.statusCode === 200) {
  const data = JSON.parse(response.body)
}
```

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

interface PluginUnitApi {
  on(typeId: string, event: UnitDeviceEventType, options?: RegisterEventOptions): Promise<void>
  off(typeId: string, event: UnitDeviceEventType, handler: PluginEventHandler): Promise<void>
  setFunction(serialNumber: string, unitUuid: string, functionId: string): Promise<void>
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

`hostApi.chart` 用于把插件自定义性能/传感器数据接入内置 Chart Unit 的数据树。实时数据只保存在 host runtime cache 中，不写入项目文件或 `defaultData`；插件禁用、卸载、进程退出或崩溃时，宿主会清理该插件注册的数据源和 entries。

`sourceId` 是插件内本地 ID，只允许字母、数字、`.`、`_`、`-`。entry 的 `key` 也是插件内本地 key；宿主会生成全局 key，插件不能提供 `providerId`、`category`、`historyValues` 等宿主字段。

`publishEntries()` 每次发布的是整个 data source 的快照。调用过快时，宿主按最小间隔合并，只保留最新 pending 快照。

`groupPath` 支持多级分组；Chart 选择器会显示为 `Plugins -> 数据源 -> groupPath... -> entry`。如果某个选择器启用 plugin-only 模式，会隐藏 `Plugins` 顶层，直接从数据源开始显示。

`type` 决定默认格式化和图标；`unit`、`precision`、`min`、`max` 可覆盖显示单位、精度和量程。

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
| 调用网络 API | `definitions`, `http`, `store`, `logger` |
| 读写本地文件 | `definitions`, `file`, `logger` |
| 访问剪贴板 | `definitions`, `electron.clipboard`, `ui` |

<!-- plugin-cycled-slider:start -->
## Plugin Unit Runtime API

`hostApi.unit` 需要 `unit` 权限。权威接口见上方 Unit API；本节补充 plugin `cycled`、`slider`、`value-label` 和 `label` 的运行时语义。

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

`setValueLabelData()` 只作用于已加载、属于当前插件、且定义类型为 `value-label` 的 Unit。宿主会使用注册定义里的 `valueLabel` 配置生成最终显示文本，并发布给目标设备。

```ts
await this.hostApi.unit.setValueLabelData(
  event.payload.serialNumber,
  event.payload.uuid,
  23.5,
)
```

规则：

- `format` 模式只接受有限 `number`，并按注册的 `format` 生成 `displayText`。
- `custom` 模式接受 `number | string`，不会检查运行时文本是否都存在于 atlas 中；缺失字符由设备端显示为方框。
- 该 API 要求 `unit` 权限，并要求目标 Unit 已加载到指定设备。
- `value-label` 不产生设备端 `changed` 事件；插件需要主动调用该 API 更新显示。

### label 文本更新

`setLabelText()` 只作用于已加载、属于当前插件、且定义类型为 `label` 的 Unit。文本必须是字符串，Unicode 内容会原样发送给设备，由设备端用定义里的 `fontFamily` 渲染。

```ts
await this.hostApi.unit.setLabelText(
  event.payload.serialNumber,
  event.payload.uuid,
  '在线',
)
```

`label` 不产生设备端 `changed` 事件；插件需要主动调用该 API 更新显示。

### runtime 主图标更新

`setUnitIcon()` 只作用于已加载、属于当前插件、且定义类型为 `value-label` 或 `label` 的 Unit。宿主会把输入标准化为 MDI codepoint payload，再发布给设备端用 MDI 字体绘制 primary icon。

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
