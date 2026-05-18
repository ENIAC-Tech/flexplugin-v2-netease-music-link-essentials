# 前端桥接

插件前端页面运行在 FlexStudio 创建的 iframe 中，不能直接访问 FlexStudio 内部模块。SDK 通过 `MessageChannel` 建立 iframe 与宿主之间的桥接，让页面可以读取主题、语言、Unit 数据、调用后端 RPC、写日志和显示宿主 snackbar。

## 页面入口

推荐使用 `mountFlexPage()` 挂载 Vue 页面：

```ts
import { mountFlexPage } from '@flexsdk/runtime'
import UnitFunctionEditor from './UnitFunctionEditor.vue'
import UnitAppearanceEditor from './UnitAppearanceEditor.vue'
import UnitView from './UnitView.vue'
import ConfigPage from './ConfigPage.vue'

mountFlexPage({
  components: {
    unitFunctionEditor: UnitFunctionEditor,
    unitAppearanceEditor: UnitAppearanceEditor,
    unitView: UnitView,
    configPage: ConfigPage,
  },
})
```

`mountFlexPage()` 会完成：

- 等待宿主发送 `plugin-bridge-init` 握手消息。
- 根据 `pageKind` 和 `typeId` 选择 Vue 组件。
- 创建 Vue app 并挂载到 `#app`。
- 注入透明 iframe 样式。
- 同步 FlexStudio 主题到文档和 Vuetify。
- 监听内容高度变化并上报给宿主。

## 按 typeId 指定组件

多个 Unit 共用一个前端入口时，可以按 `typeId` 分发组件：

```ts
mountFlexPage({
  components: {
    unitFunctionEditorByTypeId: {
      'acme.open-url': OpenUrlEditor,
      'acme.run-command': RunCommandEditor,
    },
    unitFunctionEditor: DefaultFunctionEditor,
    fallback: FallbackPage,
  },
})
```

分发顺序：

1. 当前 `pageKind` 对应的 `*ByTypeId[typeId]`。
2. 当前 `pageKind` 对应的默认组件。
3. `fallback`。
4. 如果都不存在，抛出错误。

## 安装 Vue 插件

需要安装 Vuetify 或其他 Vue 插件时，使用 `setupApp`：

```ts
import { createVuetify } from 'vuetify'
import { mountFlexPage } from '@flexsdk/runtime'

const vuetify = createVuetify()

mountFlexPage({
  components: {
    configPage: ConfigPage,
  },
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

如果没有显式传入 `themeSync.vuetify`，SDK 会尝试从 Vue app 全局属性中自动检测 Vuetify 主题对象。

## useFlexBridge

在 Vue 组件中使用 `useFlexBridge()`：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useFlexBridge } from '@flexsdk/runtime'

const {
  isReady,
  error,
  theme,
  language,
  typeId,
  pluginUUID,
  unitData,
  setUnitData,
  backendRpc,
  showSnackbarMessage,
} = useFlexBridge()

const title = computed(() => unitData.value.title ?? '')

async function saveTitle(value: string) {
  await setUnitData({
    ...unitData.value,
    title: value,
  })
  await showSnackbarMessage({ message: 'Saved', type: 'success' })
}

async function testBackend() {
  await backendRpc('ping', [{ typeId: typeId.value }])
}
</script>
```

返回值：

| 字段 | 说明 |
| --- | --- |
| `isReady` | bridge 握手完成后为 `true`。 |
| `error` | 初始化或请求失败时的错误消息。 |
| `theme` | 当前宿主主题。 |
| `language` | 当前宿主语言。 |
| `typeId` | 当前正在编辑或渲染的 Unit `typeId`。配置页为空字符串。 |
| `pluginUUID` | 当前插件 UUID。 |
| `unitData` | 当前 Unit 数据。配置页为空对象。 |
| `setUnitData(data)` | 更新当前 Unit 数据。 |
| `backendRpc(method, params)` | 调用插件后端注册的 RPC。 |
| `showSnackbarMessage(options)` | 在 FlexStudio 主 UI 中显示 snackbar。 |
| `bridge` | 原始 bridge 实例。 |

## 原始 bridge

需要更底层控制时，可以直接调用 `createFrontendBridge()`：

```ts
import { createFrontendBridge } from '@flexsdk/runtime'

const { bridge, typeId, pluginUUID, pageKind } = await createFrontendBridge()

const theme = await bridge.getTheme()
const language = await bridge.getLanguage()
const data = await bridge.getUnitData()

await bridge.setUnitData({ ...data, enabled: true })
await bridge.backendRpc('refresh', [typeId])
```

`createFrontendBridge()` 默认等待 8000ms。超时通常说明页面没有运行在 FlexStudio 插件 iframe 中，或 manifest 入口路径不正确。

可以传入自定义超时：

```ts
const context = await createFrontendBridge(12000)
```

## Bridge API Reference

```ts
interface PluginFrontendBridge {
  getTheme(): Promise<string>
  getLanguage(): Promise<string>
  onThemeChange(handler: (theme: string) => void): () => void
  onLanguageChange(handler: (lang: string) => void): () => void
  onHostEvent(event: string, handler: (data: any) => void): () => void
  logger: FrontendBridgeLogger
  backendRpc(method: string, params?: any[]): Promise<any>
  getUnitData(): Promise<any>
  setUnitData(data: any): Promise<void>
  getSelectedFunctionContext(): Promise<PluginSelectedFunctionContext | null>
  setSelectedFunctionData(functionId: string, data: any): Promise<void>
  getUnit(): Promise<any>
  setUnit(unit: any): Promise<void>
  notifyViewReady(): void
  showSnackbarMessage(options: SnackbarMessageOptions): Promise<void>
}
```

### 主题与语言

```ts
const theme = await bridge.getTheme()
const language = await bridge.getLanguage()

const offTheme = bridge.onThemeChange((nextTheme) => {
  document.documentElement.dataset.flexTheme = nextTheme
})

const offLanguage = bridge.onLanguageChange((nextLanguage) => {
  console.log(nextLanguage)
})
```

取消监听：

```ts
offTheme()
offLanguage()
```

### 宿主事件

`onHostEvent()` 监听宿主推送到 iframe 的事件。例如 `useFlexBridge()` 内部会监听：

- `unit-data-updated`
- `unit-updated`
- `themeChanged`
- `languageChanged`

```ts
const off = bridge.onHostEvent('unit-updated', (payload) => {
  console.log(payload.unit)
})
```

### 日志

```ts
bridge.logger.debug('debug')
bridge.logger.info('opened editor')
bridge.logger.warn('missing optional value')
bridge.logger.error(new Error('failed'))
```

前端日志会转发到插件后端日志。

### 后端 RPC

```ts
const result = await bridge.backendRpc('lookupUser', ['42'])
```

后端需要先注册同名方法：

```ts
this.registerRendererRpc('lookupUser', async (id: string) => {
  return { id, name: 'Ada' }
})
```

### Unit 数据

功能编辑器通常读写 `unitData`：

```ts
const data = await bridge.getUnitData()
await bridge.setUnitData({ ...data, value: 42 })
```

外观编辑器和运行视图可能需要完整 Unit：

```ts
const unit = await bridge.getUnit()
await bridge.setUnit({
  ...unit,
  data: {
    ...unit.data,
    label: 'Updated',
  },
})
```

### Unit View Ready

`unit-view` 页面完成首帧渲染后，可以通知宿主：

```ts
bridge.notifyViewReady()
```

这用于让宿主知道 iframe 内容可以被捕获或展示。

## Bridge Reinitialize

FlexStudio 可能在同一个 iframe 文档中重新建立 bridge，例如当前编辑的 Unit 实例变化但 `typeId` 和入口 URL 没变。可以监听重新握手：

```ts
import { onFrontendBridgeReinitialized } from '@flexsdk/runtime'

const off = onFrontendBridgeReinitialized(({ typeId, pluginUUID, pageKind }) => {
  console.log('bridge reinitialized', typeId, pluginUUID, pageKind)
})
```

## 页面类型

```ts
type PluginIframePageKind =
  | 'unit-function-editor'
  | 'unit-appearance-editor'
  | 'unit-view'
  | 'config-page'
```

页面类型由 FlexStudio 根据 manifest 入口和当前上下文发送给 iframe。

## iframe 样式约定

SDK 会自动设置透明背景、隐藏滚动条并上报内容高度。编辑器页面使用内容高度，`unit-view` 页面填满宿主分配的 Unit 区域。

开发者仍应避免在插件页面中使用固定全屏布局，除非该页面是 `unit-view`。

<!-- plugin-cycled-slider:start -->
## Plugin cycled Function Bridge

当 `cycled` Unit 提供 `unitFunctionEditor` 时，同一个 iframe 组件用于编辑所有函数，但宿主会把当前选中的函数上下文通过 bridge 暴露给前端。不要使用自定义 props 契约。

`useFlexBridge()` 新增：

```ts
const {
  unitData,
  selectedFunctionContext,
  setSelectedFunctionData,
} = useFlexBridge()
```

`selectedFunctionContext` 的结构：

```ts
interface PluginSelectedFunctionContext {
  functionId: string
  functionIndex: number
  name?: string
  data: Record<string, any>
}
```

`unitData` 在 plugin `cycled` function editor 中会指向当前选中函数的 `data`。保存时应调用：

```ts
await setSelectedFunctionData(
  selectedFunctionContext.value!.functionId,
  {
    ...unitData.value,
    command: 'pause',
  },
)
```

原始 bridge 也提供：

```ts
await bridge.getSelectedFunctionContext()
await bridge.setSelectedFunctionData(functionId, data)
```

`name` 和 `appearance` 仍由宿主已有编辑器管理。插件函数编辑器只负责该函数的业务 `data`。
<!-- plugin-cycled-slider:end -->
