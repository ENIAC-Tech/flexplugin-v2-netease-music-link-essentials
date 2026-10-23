# 前端桥接

插件前端页面运行在 FlexStudio 创建的 iframe 中，不能直接访问 FlexStudio 内部模块。SDK 通过 `MessageChannel` 建立 iframe 与宿主之间的桥接，让页面可以读取主题、语言、Unit 数据、调用后端 RPC、写日志和显示宿主 snackbar。

## 页面入口

推荐使用 `mountFlexPage()` 挂载 Vue 页面：

```ts
import { mountFlexPage } from '@flexsdk/runtime/vue'
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
- 传入 `preferredWidth` 时向宿主声明编辑器的期望宽度（见下文“宽度协商”）。

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
import { mountFlexPage } from '@flexsdk/runtime/vue'

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
import { useFlexBridge } from '@flexsdk/runtime/vue'

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
  openConfigPage,
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

async function openSettings() {
  await openConfigPage()
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
| `convertUnit({ unitId, data?, appearance?, icon? })` | 把当前 Unit 转换为**同一插件**的另一个 Unit 定义（`unitId` 是插件自己的 `plugin.unitId`，不是 `typeId`）。宿主用目标定义的模板构建新 Unit，保留 `uuid`、几何、父级和名称；`data` 合并到模板默认数据之上；`appearance`、`icon` 若提供则替换模板的外观和图标；转换与绑定是一次原子提交。目标不属于本插件或 `unitId` 未知时 Promise 被拒绝。见 ADR 0026。 |
| `backendRpc(method, params)` | 调用插件后端注册的 RPC。 |
| `subscribeRendererState(channel, handler, options)` | 订阅同插件后端的 retained Renderer State Channel。 |
| `showSnackbarMessage(options)` | 在 FlexStudio 主 UI 中显示 snackbar。 |
| `openConfigPage()` | 请求 FlexStudio 打开当前插件的设置页。宿主会按当前 iframe 上下文解析插件 UUID，插件不能用它打开其它插件的设置页。 |
| `bridge` | 原始 bridge 实例。 |

### Unit 写入规则

`setUnitData`、`setUnit`、`convertUnit` 是插件编辑器写入 Unit 的三个入口，都经过宿主**唯一**的写入规范化与校验，插件不要（也不应）自己再做一遍：

- 根 `uuid` 保持不变；其余不是包 UUID 的标识（子 Unit、外观元素）由宿主按“根 uuid + 位置”稳定派生，重复写入同一份数据结果相同。
- `fixedAppearance` 缺省为 `false`；`mdi-*` 图标转换为 `builtin:icon:*`（未知图标名会被拒绝）。
- 结果按保存项目的规则校验，包括 native-text 的格式域：`value-label` 的 `valueLabel` 配置缺失或格式不合法、`slider` 的 `format` 不合法，会在**编辑时**被拒绝，而不是等到上传设备才报 `invalid-value-label-domain`。

校验失败时，请求以 `Error` 拒绝，消息就是原因（对应桥消息 `set-unit-error`、`set-unit-data-error`、`convert-unit-error`），宿主同时给用户弹出提示。插件应该捕获并显示自己的状态，不要假定写入一定成功。

各入口的专有规则：

| 入口 | 规则 |
| --- | --- |
| `setUnitData(data)` | **整体替换** `unit.data`。只写自己关心的字段会丢掉类型所需的其他配置（例如数值标签的 `valueLabel`、滑块的 `slider`、按钮组的 `functions`）。请基于当前 `unitData` 合并后再写入。 |
| `setUnit(unit)` | 替换完整 Unit，用于外观编辑器等。`uuid`、`typeId`、`plugin` 不能改变，否则被拒绝；要改变 Unit 定义请使用 `convertUnit`。 |
| `convertUnit(request)` | 见下一节。 |

`visibleInLibrary: false` 的定义只是不出现在库里，仍然会被解析：已有项目里的该类型 Unit 照常加载、编辑，也可以作为 `convertUnit` 的目标。

## 转换 Unit：`convertUnit`

`convertUnit` 把当前 Unit 转换为**同一插件**的另一个 Unit 定义，典型用法是库里只放一个“Control”占位，用户选好设备和控件后由插件决定实际的原生类型（开关、滑块、选项、数值、文本、图表）。

```ts
await convertUnit({
  unitId: 'slider',          // 目标定义的 plugin.unitId，不是 typeId
  data: { ...binding, ...nativeConfig }, // 合并到模板默认数据之上
  appearance: faces,         // 可选：替换模板外观
  icon: 'mdi-thermometer',   // 可选：替换模板图标
})
```

| 字段 | 说明 |
| --- | --- |
| `unitId` | 目标定义的 `plugin.unitId`（必填）。必须属于调用方插件，未知或属于其他插件时 Promise 被拒绝。 |
| `data` | 可选，合并到目标模板的默认 `data` 之上。转换和绑定因此是一次原子提交，对应一次撤销。 |
| `appearance` | 可选，替换模板的外观（`Appearance[]`）。不提供时使用模板外观，其图标是定义的通用图标。 |
| `icon` | 可选，替换模板的 Unit 图标。 |

宿主用目标定义的模板构建新 Unit，保留 `uuid`、几何、所在位置（父级）和用户已改的名称。当前 Unit 不属于调用方插件、编辑上下文没有可转换的 Unit，或结果不是合法 Unit 时，请求被拒绝。**不要**用 `setUnit` 改写 `typeId` / `plugin` 来代替转换。

转换后宿主会按新类型重新挂载编辑器，所以同一个编辑器组件应当注册给所有可能成为转换结果的类型。目标类型所需的原生配置（滑块范围、数值标签格式、按钮选项）必须随 `data` 一起提供；缺失时会被上面的格式规则拒绝。

## 布局上下文：按设备区分外观

`getLayoutContext()`（`useFlexBridge`）返回当前项目目标设备的网格信息：

```ts
interface PluginLayoutContext {
  columns: number            // 网格列数
  rows: number               // 网格行数
  containerTitleCells: number // 容器标题占用的格数
  orientation: 'landscape' | 'portrait'
  deviceModel: string        // 'Flow2Pro'、'FlexbarV2' 等目录型号；未知时为空字符串
}
```

设备排版优先在 Unit 的 `layouts` 中声明，由宿主在添加和跨设备 Page 转换时自动选择。插件自行生成子 Unit 时，从 `@flexsdk/types` 导入 `selectUnitDeviceLayoutV1`，调用 `selectUnitDeviceLayoutV1(definition.layouts, context.deviceModel)` 复用同一选择规则；未知型号或空字符串使用 default。不要从网格形状猜型号，也不要在普通加载时重写已保存的外观。Flow2Pro 为 12×1 格、格宽 134px，Flexbar 为 31×1 格、格宽 60px，两者都是单行；`columns`/`rows` 反映的是设备网格，不是容器内部的行数。

## usePluginI18n

Vue 插件页面推荐使用 SDK 官方 i18n adapter，而不是在每个插件里复制一份私有 `i18n.ts`：

```vue
<script setup lang="ts">
import en from '../../locales/en.json'
import zhCN from '../../locales/zh-CN.json'
import { usePluginI18n } from '@flexsdk/runtime/vue'

const { locale, language, t } = usePluginI18n({
  defaultLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
    zh: zhCN,
  },
})
</script>

<template>
  <v-btn>{{ t('actions.save') }}</v-btn>
  <span>{{ t('status.connectedAs', { name: 'Flexbar' }) }}</span>
</template>
```

`usePluginI18n()` 会读取 `useFlexBridge().language`，并随宿主语言变化重新匹配 locale。返回值：

| 字段 | 说明 |
| --- | --- |
| `language` | 宿主当前语言 ref，例如 `en`、`zh-CN`。 |
| `locale` | 实际命中的插件资源 locale。匹配顺序为精确 locale → 基础语言 → `defaultLocale`。 |
| `t(key, params)` | 翻译函数。缺失 key 返回 key；插值支持 `{{name}}` 和 `{name}`。 |

如果不使用 Vue，也可以从 `@flexsdk/runtime` 导入框架无关的 `createPluginI18n()` 或 `translate()`。当前 SDK 不默认自动读取 `dist/locales/{locale}.json`；插件应显式导入或传入 messages，避免 iframe asset base path、dev/prod 路径和 CSP 差异带来的不确定性。

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
await bridge.openConfigPage()
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
  /** uuid / typeId / plugin 不能改变；经宿主统一规范化与校验，失败时拒绝并附原因。 */
  setUnit(unit: any): Promise<void>
  /** 转换为同一插件的另一个 Unit 定义，保留 uuid、几何、父级和名称。 */
  convertUnit(request: { unitId: string; data?: Record<string, any>; appearance?: any[]; icon?: string }): Promise<void>
  notifyViewReady(): void
  showSnackbarMessage(options: SnackbarMessageOptions): Promise<void>
  openConfigPage(): Promise<void>
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

## Renderer State Channel

```ts
subscribeRendererState<T extends Record<string, RendererStateJson>>(
  channel: string,
  handler: (event: RendererStateEnvelope<T>) => void | Promise<void>,
  options?: { replayLatest?: boolean }
): Promise<() => Promise<void>>
```

Host 从已认证 iframe session 推导 plugin UUID/session identity；renderer 只提供 channel、handler 与 options，绝不能提交 UUID 或 session ID。每个 subscription 的 handler 串行执行，成功或抛错后 bridge 都会 ACK，使 Host 可以继续队列或触发 resync。页面/session 销毁时 Host 自动清理，但组件仍应主动 unsubscribe。

Vue 示例（无 polling）：

```ts
import { onMounted, onUnmounted, ref } from 'vue'
import { useFlexBridge } from '@flexsdk/runtime/vue'

const { bridge } = useFlexBridge()
const state = ref<Record<string, unknown> | null>(null)
let epoch = -1
let revision = -1
let unsubscribe: (() => Promise<void>) | undefined

onMounted(async () => {
  unsubscribe = await bridge.value!.subscribeRendererState(
    'runtime-status',
    async (event) => {
      if (event.providerEpoch < epoch) return
      if (event.providerEpoch > epoch) {
        state.value = null
        epoch = event.providerEpoch
        revision = -1
      }
      // Lifecycle messages do not depend on a new data revision.
      if (event.kind === 'available') return
      if (event.kind === 'unavailable') {
        if (event.revision < revision) return
        state.value = null
        revision = event.revision
        return
      }
      if (event.revision <= revision) return
      // Host materializes provider patches into authoritative snapshots.
      if (event.kind === 'snapshot') state.value = { ...event.payload }
      else if (event.resyncRequired) state.value = null
      else state.value = null
      revision = event.revision
    },
    { replayLatest: true }
  )
})

onUnmounted(() => { if (unsubscribe) void unsubscribe() })
```

`available`/`unavailable` 表示 Provider 可用性。旧 epoch 必须先忽略。可用性事件先于数据 revision 去重处理。新 epoch 会丢弃本地缓存；完整 snapshot 可直接跨越 revision gap 替换本地状态。Provider 发布的 delta 是输入 Merge Patch，Host 合并后统一发送完整 snapshot；Host 发出的 `kind: 'snapshot', resyncRequired: true` 是权威恢复状态，应清空后立即应用该 snapshot。只有非 snapshot 的 `resyncRequired` 才清空并等待完整 snapshot。输入与合并后的 retained state 上限均为 64 KiB。

后端需要先注册同名方法：

```ts
this.registerRendererRpc('lookupUser', async (id: string) => {
  return { id, name: 'Ada' }
})
```

### 打开插件设置页

当插件前端发现必须引导用户完成配置时，可以请求 FlexStudio 打开当前插件的设置页：

```ts
await bridge.openConfigPage()
```

在 Vue 组件中也可以通过 `useFlexBridge()` 使用：

```ts
const { openConfigPage } = useFlexBridge()

await openConfigPage()
```

这个 API 不接收插件 UUID。FlexStudio 会根据当前 iframe 的 bridge 上下文打开同一个插件的设置页，避免插件跳转到其它插件的设置界面。

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

### 共享外观操作

有 `setUnit` 写权限的插件外观编辑器可以直接使用公共外观函数。Panel 和 cycled 的外观仍由宿主现有编辑器管理；纯函数也可用于模板生成和显式迁移，不会扩大 iframe 的既有权限。

```ts
import {
  unitAppearanceTargets, unitAppearanceElements,
  updateUnitAppearance, arrangeAppearanceElements,
} from '@flexsdk/runtime'

const unit = await bridge.getUnit()
const target = unitAppearanceTargets(unit)[0] // 实际 UI 使用用户选中的目标
if (target) {
  const editable = unitAppearanceElements(unit, target.id)
    .filter(element => !element.config?.pinned)
  const replacements = new Map(
    arrangeAppearanceElements(editable, { columns: 2 })
      .map(element => [element.uuid, element]),
  )
  const next = updateUnitAppearance(unit, target.id, appearance => ({
    ...appearance,
    elements: appearance.elements.map(element => replacements.get(element.uuid) ?? element),
  }))
  await bridge.setUnit(next) // 一次提交，沿用宿主校验、草稿和历史
}
```

目标切换只更新插件本地选择。不要为排版维护第二份布局、直接修改返回的 Unit、绕开 `setUnit` 写项目，或用 `setUnitData` 保存外观。无效目标/排版参数应在提交前显示错误，保留原 Unit。详见[多状态外观约定](./unit-definitions.md#多状态外观与公共编辑接口)。

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

### 宽度协商

iframe 没有可供宿主测量的内容宽度，宿主无法根据编辑器内容自动决定弹窗宽度。编辑器页面可以向宿主声明一个期望宽度（CSS px），宿主会在自己能提供的空间内取值：

```ts
mountFlexPage({
  components: { unitFunctionEditor: UnitFunctionEditor },
  // 单个数字作用于所有编辑器页面；也可以按 pageKind 分别声明
  preferredWidth: { 'unit-function-editor': 560 }
})
```

运行时也可以随内容变化调整，传 `null` 撤回声明、使用宿主默认宽度：

```ts
import { setPreferredContentWidth } from '@flexsdk/runtime'

setPreferredContentWidth(advancedMode ? 640 : 480)
```

- 声明值只是期望：宿主先把它限制在 240–1200 px，再由所在的编辑器外壳（如 Unit 浮动编辑器，最大 680 px 且不超过窗口）进一步限制。页面布局必须能在更窄的宽度下正常换行。
- 不声明时沿用宿主默认宽度。
- 宿主重建 bridge 端口（`Bridge Reinitialize`）后，SDK 会自动重发最近一次声明。
- `unit-view` 页面由 Unit 尺寸决定大小，忽略该声明。
- 协议消息为 `{ type: 'content-preferred-width', width: number | null }`，与 `content-resize`（高度）相互独立；不支持该消息的旧版宿主会忽略它。

<!-- plugin-cycled-slider:start -->
## Plugin cycled / button-group Function Bridge

当 `cycled` 或 `button-group` Unit 提供 `unitFunctionEditor` 时，同一个 iframe 组件用于编辑所有函数或按钮，但宿主会把当前选中的函数/按钮上下文通过 bridge 暴露给前端。不要使用自定义 props 契约。

`useFlexBridge()` 提供：

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
  buttonId?: string
  buttonIndex?: number
  name?: string
  data: unknown
}
```

`unitData` 在 plugin `cycled` function editor 中会指向当前选中函数的 `data`；在 plugin `button-group` function editor 中会指向当前选中按钮的 `pluginData`。保存时应调用：

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

`cycled` 的 `name` 和 `appearance` 仍由宿主已有编辑器管理。`button-group` 的按钮名称、显示模式、颜色、激活态和外观同步也由宿主编辑器管理；插件函数编辑器只负责当前函数或按钮的业务数据。
<!-- plugin-cycled-slider:end -->

前端桥接请求超时为 20 秒，覆盖宿主 backend RPC 的 15 秒等待窗口。超时不会自动取消已经执行的后端操作；较长工作应以 job 启动并通过 State Channel 汇报状态。

## 宿主标准表单

编辑器和配置页通过 `useFlexBridge().openFormDialog(form)` 打开宿主 FormDialog。表单包含 title、confirmText、cancelText、requiredText、tooLongText 和 fields。每个字段声明 key、label、type（text / textarea / select）、value，可选 required、maxBytes；select 使用 items: [{ value, title }]。

确认返回字段键到字符串的映射；取消返回 null，iframe 断开时取消。宿主执行必填、UTF-8 字节长度和选项校验；插件收到结果后仍校验业务规则，再用 setUnitData 保存。表单等待不使用普通 RPC 的 20 秒超时，不接收 HTML 或回调。一次只显示一个插件表单。unit-view 不允许打开表单。

## 跨 iframe 的选择菜单（SDK 2.2）

从 `@flexsdk/runtime/vue` 导入 `FlexChoice`，以 v-model、label、items（`{title, value, disabled?}`）绑定选项。一个选项展示只读值，两个选项展示 grouped button，三个及以上打开宿主菜单。不要在插件 iframe 内通过增高 iframe 或 overflow hack 修补弹层裁切。

底层 `bridge.openChoiceMenu({label, value?, items, anchor:{x,y,width,height}})` 返回 `{value}` 或取消时的 null。anchor 是 iframe 内 CSS 像素坐标，宿主负责坐标换算、屏幕边界和菜单层级。value 为 string 或 number；items 1–256 项，value 不重复。仅编辑器和设置页可用，unit-view 不可用。

用户选择不受普通 RPC 超时限制。编辑上下文切换、iframe 销毁、外部滚动/窗口缩放会取消菜单，避免旧结果写入新 Unit。FlexChoice 支持键盘打开并在关闭后归还焦点；使用 error 事件处理失败。

## 设备输入功能

物理控件绑定使用 `defineFunction` / `FlexPluginBase.functions`，独立于 Unit 定义。声明 `input` 权限；复杂设置使用 `input-function-settings` 和绑定会话桥接，反馈通过当前上下文，状态按设备与绑定隔离。完整生命周期、字段、触觉和验证要求见[输入功能](./input-functions.md)。

## Composite 的编辑边界

Composite 的平铺元素由宿主高级编辑器编辑，插件可提供业务功能编辑器，不能注册自定义外观编辑器或运行视图。Button 配置按 UUID 保存在 `unit.data.buttonConfigs`，复制／删除与配置映射同属一次编辑。必需元素不能通过 whole-Unit 写入删除或解锁。

`convertUnit` 会导入目标定义的 `composite.resources`，按内容去重并重写引用，与 Unit 转换组成一次 Project 提交和一次撤销。`setUnit` / `setUnitData` 对真实项目资源做引用校验；不存在的 asset 会拒绝，不等待上传才发现。异步提交期间项目／Unit 已变化时返回 `PLUGIN_UNIT_WRITE_STALE`，重新读取当前编辑上下文后再由用户决定；失败不会污染草稿或历史。运行时业务变化使用 Composite API，不调用这三个编辑写入接口保存瞬态状态。
