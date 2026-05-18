# Unit 定义

插件的 Library 和 Unit 不写在 `manifest.json` 中，而是在插件后端运行时注册。FlexStudio 会把这些定义合并到资源面板和 Unit 创建流程中。

## Payload 结构

```ts
interface PluginDefinitionsPayload {
  libraries: PluginLibraryDefinition[]
  units: PluginUnitDefinitionRuntime[]
  revision?: string
}
```

插件通常在 `FlexPluginBase.getDefinitions()` 中返回 payload：

```ts
import { FlexPluginBase } from '@flexsdk/runtime'
import type { PluginDefinitionsPayload } from '@flexsdk/types'

export default class DemoPlugin extends FlexPluginBase {
  async getDefinitions(): Promise<PluginDefinitionsPayload> {
    const library = this.createDefaultLibrary({
      libraryUUID: '@acme/demo-plugin/main',
      name: 'Demo Plugin',
      icon: 'mdi-puzzle',
      categoryId: 'plugin',
    })

    return {
      libraries: [library],
      units: [
        this.createUnitTemplate({
          unitId: '@acme/demo-plugin/action-button',
          typeId: 'acme.action-button',
          name: 'Action Button',
          categoryId: 'plugin',
          libraryUUID: library.libraryUUID,
          hasFunctionEditor: true,
          hasAppearanceEditor: true,
          defaultData: {
            action: 'open-url',
            url: 'https://example.com',
          },
        }),
      ],
      revision: '1.0.0',
    }
  }
}
```

`createDefaultLibrary()` 和 `createUnitTemplate()` 会填充常用默认值，包括 `plugin.pluginUUID`、`plugin.pluginVersion` 和 `plugin.unitId`。

## Library Definition

```ts
interface PluginLibraryDefinition {
  libraryUUID: string
  name: string
  icon?: string
  categoryId?: string
}
```

| 字段 | 说明 |
| --- | --- |
| `libraryUUID` | Library 稳定 ID。一个插件可以有多个 Library。 |
| `name` | 在 Unit 浏览器中展示的 Library 名称。 |
| `icon` | 可选图标。通常使用 Material Design Icons 名称。 |
| `categoryId` | 可选分类 ID。 |

如果 payload 中有 Unit 但没有 Library，宿主会为插件生成一个默认 Library。不过为了可读性和可控排序，建议显式声明 Library。

## Unit Definition

```ts
interface PluginUnitDefinitionRuntime {
  unitId: string
  typeId: string
  name: string
  categoryId: string
  plugin: PluginUnit
  icon?: string
  hasFunctionEditor?: boolean
  hasAppearanceEditor?: boolean
  hasView?: boolean
  appearanceOverride?: PluginAppearanceOverride
  functions?: PluginUnitDefinitionCycledFunction[]
  slider?: PluginUnitDefinitionSliderConfig
  valueLabel?: PluginUnitDefinitionValueLabelConfig
  label?: PluginUnitDefinitionLabelConfig
  defaultData?: Record<string, any>
  platforms?: ('win32' | 'darwin' | 'linux')[]
  libraryUUID?: string
}
```

| 字段 | 说明 |
| --- | --- |
| `unitId` | 插件内稳定 Unit ID。必须与 `plugin.unitId` 一致。 |
| `typeId` | FlexStudio 中用于识别 Unit 类型的全局类型 ID。不同插件之间不能重复。 |
| `name` | Unit 显示名称。 |
| `categoryId` | Unit 分类 ID。 |
| `plugin` | 插件元数据，标记该 Unit 由哪个插件提供。 |
| `icon` | 可选图标。 |
| `hasFunctionEditor` | 是否提供功能编辑器页面。 |
| `hasAppearanceEditor` | 是否提供外观编辑器页面。 |
| `hasView` | 是否提供运行视图 iframe。 |
| `appearanceOverride` | 可选宿主默认外观覆盖。 |
| `functions` | `cycled` Unit 的固定函数列表。 |
| `slider` | `slider` Unit 的数值范围、步进和显示格式。 |
| `valueLabel` | `value-label` Unit 的 format/custom 模式配置。 |
| `label` | `label` Unit 的设备端 TTF 字体配置。 |
| `defaultData` | 创建 Unit 实例时的默认数据。 |
| `platforms` | Unit 支持的平台，使用 `win32`、`darwin`、`linux`。 |
| `libraryUUID` | Unit 所属 Library。省略时使用 payload 中第一个 Library。 |

## Plugin Unit Metadata

```ts
interface PluginUnit {
  type: 'standard' | 'custom' | 'canvas' | 'cycled' | 'slider' | 'value-label' | 'label'
  pluginUUID: string
  pluginVersion: string
  unitId: string
}
```

| 字段 | 说明 |
| --- | --- |
| `type` | Unit 类型：`standard`、`custom`、`canvas`、`cycled`、`slider`、`value-label` 或 `label`。 |
| `pluginUUID` | 注册该 Unit 的插件 UUID，必须与当前插件一致。 |
| `pluginVersion` | 当前插件版本。通常由 `FlexPluginBase` 从加载上下文填充。 |
| `unitId` | 插件内 Unit ID，必须与外层 `unitId` 一致。 |

## Unit 数据版本与迁移

`defaultData` 只影响新建 Unit，不会自动改写项目里已经存在的 Unit。插件发布新版本时，如果 `unit.data` 的结构发生破坏性变化，应在数据中维护插件自己的 schema 版本，并在后端实现 `migrateUnit()`。

推荐写法：

```ts
this.createUnitTemplate({
  unitId: '@acme/demo-plugin/action-button',
  typeId: 'acme.action-button',
  name: 'Action Button',
  categoryId: 'actions',
  defaultData: {
    schemaVersion: 2,
    label: 'Action',
    action: 'open-url',
  },
})
```

宿主不会推断旧数据结构，也不会根据新的 `defaultData` 自动补字段。迁移由插件自己的 `migrateUnit(request)` 决定：常见场景返回 `{ data }`，只替换 `unit.data`；只有确实需要改 `name`、`icon`、`config` 或 `appearance` 时才返回完整 `{ unit }`。

迁移结果必须保持 Unit 身份和布局稳定：不能改变 `uuid`、`typeId`、`plugin.pluginUUID`、`plugin.unitId` 或 `geometry`。迁移成功后，宿主会把 `unit.plugin.pluginVersion` 更新到当前插件版本，并刷新 preset 的 `pluginDependencies` 快照。

## Unit 类型

### standard

`standard` 使用宿主默认 Unit 视图，可以选择提供功能编辑器和外观编辑器。

适合：

- 按钮、快捷操作、系统命令、HTTP 请求等逻辑型 Unit。
- 视觉结构可以由宿主默认外观系统表达的 Unit。

示例：

```ts
this.createUnitTemplate({
  unitId: '@acme/demo-plugin/open-url',
  typeId: 'acme.open-url',
  name: 'Open URL',
  categoryId: 'actions',
  hasFunctionEditor: true,
  hasAppearanceEditor: true,
})
```

### custom

`custom` 使用插件提供的 `unitView` iframe 渲染运行视图，必须设置 `hasView: true`。

适合：

- 需要完全自定义运行视图的 Unit。
- 需要在设备区域显示动态 HTML/CSS/Vue UI 的 Unit。

示例：

```ts
this.createUnitTemplate({
  unitId: '@acme/demo-plugin/weather-card',
  typeId: 'acme.weather-card',
  name: 'Weather Card',
  categoryId: 'widgets',
  plugin: {
    type: 'custom',
    pluginUUID: this.pluginUUID,
    pluginVersion: this.pluginVersion,
    unitId: '@acme/demo-plugin/weather-card',
  },
  hasFunctionEditor: true,
  hasView: true,
})
```

### canvas

`canvas` 不使用前端运行视图，也不能提供外观编辑器。插件后端在设备 Unit 加载后，通过 `hostApi.canvas.pushFrame()` 推送 PNG 帧，由宿主编码后发送到设备。

适合：

- 后端生成画面的动态显示。
- 需要精确控制像素输出的 Unit。
- 使用 native 或 Node canvas 渲染的场景。

限制：

- `hasView` 不能为 `true`。
- `hasAppearanceEditor` 不能为 `true`。
- 通常需要监听 Canvas Unit 的 `load` 和 `unload` 事件来启动和停止渲染循环。

示例：

```ts
this.createUnitTemplate({
  unitId: '@acme/demo-plugin/canvas-clock',
  typeId: 'acme.canvas-clock',
  name: 'Canvas Clock',
  categoryId: 'widgets',
  plugin: {
    type: 'canvas',
    pluginUUID: this.pluginUUID,
    pluginVersion: this.pluginVersion,
    unitId: '@acme/demo-plugin/canvas-clock',
  },
  hasFunctionEditor: true,
})
```

## 校验规则

FlexStudio 注册定义时会执行结构校验和一致性校验：

- payload 必须包含 `libraries` 和 `units` 数组。
- `libraryUUID` 不能重复。
- `unitId` 不能重复。
- `typeId` 在当前插件内不能重复，并且不能与其他已启用插件冲突。
- Unit 引用的 `libraryUUID` 必须存在。
- `plugin.pluginUUID` 必须等于当前注册插件 UUID。
- `plugin.unitId` 必须等于外层 `unitId`。
- `custom` Unit 必须设置 `hasView: true`。
- `canvas` Unit 不能设置 `hasView: true`。
- `canvas` Unit 不能设置 `hasAppearanceEditor: true`。
- `value-label` Unit 必须设置 `valueLabel`，不能设置 `functions`、`slider`、`label` 或 `hasView: true`。
- `label` Unit 必须设置 `label`，不能设置 `functions`、`slider`、`valueLabel` 或 `hasView: true`。
- 其它 Unit 类型不能携带不属于自身类型的 `functions`、`slider`、`valueLabel` 或 `label` 配置。

可以在构建或 CI 中使用 CLI 验证定义：

```bash
flexcli plugin-v2 validate --plugin-dir . --definitions ./dist/definitions.json
```

## defaultData

`defaultData` 会作为新建 Unit 实例的初始数据。功能编辑器和外观编辑器通常围绕这份数据读写。

建议：

- 使用可序列化 JSON。
- 为缺省字段提供明确默认值。
- 避免在 `defaultData` 中放入大体积二进制内容。
- 需要外观元素时，保持结构与 FlexStudio 的 Unit appearance 数据一致。

## 修改定义

常规做法是在 `getDefinitions()` 中返回完整定义，宿主会在插件加载后拉取。需要运行时替换定义时，可以调用：

```ts
await this.registerDefinitions(payload)
```

`registerDefinitions()` 会替换该插件此前注册的所有定义，因此传入的 payload 应包含当前插件希望暴露的完整 Library 与 Unit 集合。

<!-- plugin-cycled-slider:start -->
## Plugin cycled、slider、value-label 与 label Unit

`PluginUnit.type` 支持：

```ts
type PluginUnitType =
  | 'standard'
  | 'custom'
  | 'canvas'
  | 'cycled'
  | 'slider'
  | 'value-label'
  | 'label'
```

`PluginUnitDefinitionRuntime` 额外支持：

```ts
interface PluginUnitDefinitionRuntime {
  appearanceOverride?: PluginAppearanceOverride
  functions?: PluginUnitDefinitionCycledFunction[]
  slider?: PluginUnitDefinitionSliderConfig
  valueLabel?: PluginUnitDefinitionValueLabelConfig
  label?: PluginUnitDefinitionLabelConfig
}

interface PluginUnitDefinitionCycledFunction {
  functionId: string
  name?: string
  data?: Record<string, any>
  appearanceOverride?: PluginAppearanceOverride
}

interface PluginUnitDefinitionSliderConfig {
  format: string
  min: number
  max: number
  step?: number
}

type PluginUnitDefinitionValueLabelConfig =
  | { mode: 'format'; format: string; customCharacters?: string }
  | { mode: 'custom'; customCharacters?: string }

interface PluginUnitDefinitionLabelConfig {
  fontFamily: 'puhuiti' | 'consola'
}
```

### appearanceOverride

`appearanceOverride` 是对宿主默认外观的字段覆盖，不需要提供完整 `baseAppearance`。宿主在构建默认 Unit 时先创建默认外观，再应用插件提供的 override。

`elements` 是数组，覆盖规则不同于普通对象：

- override element 带 `identifier` 时，必须匹配默认外观中已有的 element，并只覆盖提供的字段。
- override element 不带 `identifier` 时，表示追加一个完整新 element。
- 带未知 `identifier` 的覆盖会被定义校验拒绝。

该机制适用于 `standard`、`slider`、`value-label`、`label`，以及 `cycled.functions[].appearanceOverride`。`value-label` 和 `label` 的 primary text / primary icon 是设备端运行时元素；外观覆盖可以调整它们的位置、字号、颜色等样式，但设备预渲染 PNG 不会把这两个元素画进去。

### cycled

`cycled` 是插件控制的多状态按键，适合播放/暂停、模式切换等场景。

```ts
this.createUnitTemplate({
  unitId: '@acme/media/playback',
  typeId: 'acme.media.playback',
  name: 'Playback',
  categoryId: 'media',
  plugin: {
    type: 'cycled',
    pluginUUID: this.pluginUUID,
    pluginVersion: this.pluginVersion,
    unitId: '@acme/media/playback',
  },
  hasFunctionEditor: true,
  functions: [
    {
      functionId: 'play',
      name: 'Play',
      data: { command: 'play' },
      appearanceOverride: {
        elements: [
          { identifier: 'title', text: 'Play' },
        ],
      },
    },
    {
      functionId: 'pause',
      name: 'Pause',
      data: { command: 'pause' },
      appearanceOverride: {
        elements: [
          { identifier: 'title', text: 'Pause' },
        ],
      },
    },
  ],
})
```

规则：

- `functions` 必填，且至少包含一个函数。
- 每个函数必须有稳定且唯一的 `functionId`。
- 前端不能新增、删除或排序函数。
- 用户可以通过宿主已有外观编辑器修改每个函数的外观。
- 函数外观不是 `data` 的一部分；运行时结构与内置 `cycled-key` 保持一致。
- 插件函数编辑器通过 bridge 读取和写入当前选中函数的 `data`。

设备点击后，宿主只把事件转发给拥有该 Unit 的插件，不会自动切换函数。插件业务处理成功后调用 `hostApi.unit.setFunction(serialNumber, unitUuid, functionId)` 更新设备状态；失败时应使用通知 API 报错。

### slider

`slider` 是插件控制的数值滑块，适合音量、亮度、温度等场景。

```ts
this.createUnitTemplate({
  unitId: '@acme/media/volume',
  typeId: 'acme.media.volume',
  name: 'Volume',
  categoryId: 'media',
  plugin: {
    type: 'slider',
    pluginUUID: this.pluginUUID,
    pluginVersion: this.pluginVersion,
    unitId: '@acme/media/volume',
  },
  slider: {
    format: '%0.1f %%',
    min: 0,
    max: 100,
    step: 0.1,
  },
  defaultData: {
    value: 50,
  },
})
```

规则：

- `slider` 配置必填。
- `format` 使用一个 C-style 数字占位符，例如 `%0.1f %%`。
- 不再使用 `decimals` 字段；显示精度从 `format` 中解析。
- `min` 和 `max` 必须是有限数字，且 `min < max`。
- `step` 可选；省略时宿主根据 `format` 的精度推断。
- `step` 必须为正数，不能大于范围，并且必须能按显示精度整除范围。
- 宿主和 SDK 会把值夹取并量化为 `min + round((value - min) / step) * step`。

插件监听设备滑动事件后执行业务逻辑，并可调用 `hostApi.unit.setSliderValue(serialNumber, unitUuid, value)` 更新设备显示。

### value-label

`value-label` 是插件控制的数值显示 Unit。它没有 slider 的激活态和拖动事件；插件只需要在后端发送数值或数值型字符串，设备端使用宿主预生成的 atlas 本地绘制 primary text，因此不需要用 `custom` 或 `canvas` 实时推图。

`value-label` 有两种模式：

- `format`：`format` 必填，使用一个 C-style `%f` 数字占位符，例如 `%0.1f C`。运行时只接受有限 `number`；宿主格式化后把最终 `displayText` 发给设备。charset 自动由 `0123456789.-` 加 format 字面量生成，忽略 `customCharacters`。
- `custom`：运行时接受 `number | string`。charset 由 `0123456789.` 加用户声明的 `customCharacters` 生成；最多允许 128 个去重后的自定义 grapheme。运行时文本中 atlas 缺失的字符不会导致更新失败，设备端显示方框占位。

```ts
this.createUnitTemplate({
  unitId: 'temperature',
  typeId: '@demo/sensors:temperature',
  name: 'Temperature',
  categoryId: '@demo/sensors',
  plugin: {
    type: 'value-label',
    pluginUUID: this.pluginUUID,
    pluginVersion: this.pluginVersion,
    unitId: 'temperature',
  },
  valueLabel: { mode: 'format', format: '%0.1f C' },
  defaultData: { value: 23.5 },
})
```

```ts
this.createUnitTemplate({
  unitId: 'status-code',
  typeId: '@demo/sensors:status-code',
  name: 'Status Code',
  categoryId: '@demo/sensors',
  plugin: {
    type: 'value-label',
    pluginUUID: this.pluginUUID,
    pluginVersion: this.pluginVersion,
    unitId: 'status-code',
  },
  valueLabel: { mode: 'custom', customCharacters: '-%NA' },
  defaultData: { value: 'N/A' },
})
```

规则：

- `valueLabel` 配置必填。
- 不能同时声明 `functions`、`slider` 或 `label`。
- 不能设置 `hasView: true`。
- primary text 和 primary icon 由设备端运行时绘制；预渲染 PNG 只包含背景、边框、图片和非 primary 元素。
- `value-label` 不新增设备端 `changed` 事件。插件通过 `hostApi.unit.setValueLabelData()` 和 `hostApi.unit.setUnitIcon()` 主动更新设备显示。

### label

`label` 是插件控制的 Unicode 文本显示 Unit。它不使用 atlas，而是使用设备端预置 TTF 字体渲染 primary text，适合状态消息、短文本、中文提示和代码样式文本。

```ts
this.createUnitTemplate({
  unitId: 'message',
  typeId: '@demo/text:message',
  name: 'Message',
  categoryId: '@demo/text',
  plugin: {
    type: 'label',
    pluginUUID: this.pluginUUID,
    pluginVersion: this.pluginVersion,
    unitId: 'message',
  },
  label: { fontFamily: 'puhuiti' },
  defaultData: { text: '在线' },
})
```

规则：

- `label` 配置必填。
- `fontFamily` 只能是 `puhuiti` 或 `consola`。
- 不能同时声明 `functions`、`slider` 或 `valueLabel`。
- 不能设置 `hasView: true`。
- primary text 的字体族被锁定为定义里的字体；字号、颜色、粗体、斜体等外观仍可编辑。
- primary text 和 primary icon 由设备端运行时绘制；预渲染 PNG 不包含这两个元素。
- `label` 不新增设备端 `changed` 事件。插件通过 `hostApi.unit.setLabelText()` 和 `hostApi.unit.setUnitIcon()` 主动更新设备显示。
<!-- plugin-cycled-slider:end -->
