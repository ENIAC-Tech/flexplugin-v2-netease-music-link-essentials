# Unit 定义

插件的 Library 和 Unit 不写在 `manifest.json` 中，而是在插件后端运行时注册。FlexStudio 会把这些定义合并到资源面板和 Unit 创建流程中。

## Payload 结构

```ts
interface PluginDefinitionsPayload {
  libraries: PluginLibraryDefinition[]
  units: PluginUnitDefinitionRuntime[]
  builtinUnits?: PluginBuiltinUnitTemplate[]
  revision?: string
}
```

`libraries` 和 `units` 注册插件自有 Unit；`builtinUnits` 用来把预配置的普通内置 Unit 模板放进同一个 Unit 浏览器分组。`builtinUnits` 里的条目不是新的插件 Unit 类型，也不会让宿主把该 `typeId` 标记为插件所有。

插件通常在 `FlexPluginBase.getDefinitions()` 中返回 payload：

```ts
import { FlexPluginBase, unitTemplate } from '@flexsdk/runtime'
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
          layouts: {
            default: { preferredSize: { width: 1, height: 1 } },
            devices: { FlexbarV2: { preferredSize: { width: 2, height: 1 } } },
          },
          hasFunctionEditor: true,
          hasAppearanceEditor: false,
          defaultData: {
            action: 'open-url',
            url: 'https://example.com',
          },
        }),
      ],
      builtinUnits: [
        this.createBuiltinUnitTemplate(unitTemplate, {
          uuid: '@acme/demo-plugin/media-play-template',
          typeId: '@eniacelec/media:media-key',
          name: 'Play/Pause Key',
          icon: 'mdi-play-pause',
          data: {
            keyId: 'play-pause',
            hidCode: 0x00CD,
          },
        }),
      ],
      revision: '1.0.0',
    }
  }
}
```

`createDefaultLibrary()` 和 `createUnitTemplate()` 会填充常用默认值，包括 `plugin.pluginUUID`、`plugin.pluginVersion` 和 `plugin.unitId`。helper 会保留 `interactionMode` 与 `defaultActivation`；`standard` 使用宿主外观编辑器，只有 `custom` 可以声明 `hasAppearanceEditor: true`。

`builtinUnits` 的根节点必须是普通内置 Unit，不允许 `plugin`。容器子节点可以是插件 Unit，其 `pluginUUID`、`pluginVersion`、`unitId` 与 `type` 必须匹配同一 payload 中注册的 definition；`createBuiltinUnitTemplate()` 仅移除根节点元数据，保留子节点的插件归属。整棵 builtin 模板树的 UUID 必须唯一。

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

## Built-in Unit Templates

`builtinUnits` 提供的是完整的普通内置 Unit 模板。它适合插件把常用的宿主内置 Unit 预设暴露给用户，例如预配置的媒体键、快捷键、执行命令或布局容器。用户把模板拖入项目后，得到的是普通内置 Unit，不会调用插件后端，也不会写入 `Unit.plugin` 依赖元数据。

规则：

- `typeId` 必须指向宿主已经注册的内置 Unit 类型，例如 `@eniacelec/media:media-key`。
- 模板必须是完整 Unit 结构，至少包含 `uuid`、`typeId`、`name`、`icon`、`config`、`geometry`、`appearance` 和 `data`。
- 顶层和 `data.layoutData` 嵌套 Unit 都不能包含 `plugin` 字段；SDK 的 `createBuiltinUnitTemplate()` 会递归移除插件元数据。
- `uuid` 必须稳定且在当前 payload 内唯一，不能与插件自有 Unit 生成的 `plugin-template-${typeId}` 冲突。
- 同一个 payload 可以同时包含插件自有 `units` 和普通内置 `builtinUnits`；渲染进程仍通过同一个 active units 查询接口读取，内置模板行会标记为 `kind: 'builtin'`。
- 已放入项目的内置模板不依赖插件运行时。插件被禁用或卸载后，已创建的普通内置 Unit 仍按宿主内置逻辑工作。

## Unit Definition

```ts
interface PluginUnitDefinitionRuntime {
  unitId: string
  typeId: string
  name: string
  categoryId: string
  plugin: PluginUnit
  interactionMode?: 'click' | 'continuous' | 'display'
  defaultActivation?: PluginUnitDefaultActivationConfig
  icon?: string
  hasFunctionEditor?: boolean
  hasAppearanceEditor?: boolean
  hasView?: boolean
  layouts: PluginUnitLayoutsV1
  functions?: PluginUnitDefinitionCycledFunction[]
  slider?: PluginUnitDefinitionSliderConfig
  valueLabel?: PluginUnitDefinitionValueLabelConfig
  label?: PluginUnitDefinitionLabelConfig
  buttonGroup?: PluginButtonGroupDefinition
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
| `interactionMode` | Unit 的宿主交互模式：`click`、`continuous` 或 `display`。 |
| `defaultActivation` | 新建 click-capable Unit 的默认激活方式；用户之后仍可在宿主中覆盖。 |
| `icon` | 可选图标。 |
| `hasFunctionEditor` | 是否提供功能编辑器页面。 |
| `hasAppearanceEditor` | 是否提供外观编辑器页面。 |
| `hasView` | 是否提供运行视图 iframe。 |
| `visibleInLibrary` | 默认 `true`。设为 `false` 时只从库中隐藏，定义仍然被解析：已有项目里的该类型 Unit 继续加载、编辑，并可作为 `convertUnit` 的目标。用于淘汰库入口而不破坏旧项目。 |
| `layouts` | 必填默认布局和可选的精确设备型号布局，见下文。 |
| `functions` | `cycled` Unit 的固定函数列表。 |
| `indicator` | 仅 `cycled`：可选的指示灯，见下文。 |
| `slider` | `slider` Unit 的数值范围、步进和显示格式。 |
| `valueLabel` | `value-label` Unit 的 format/custom 模式配置。 |
| `label` | `label` Unit 的设备端 TTF 字体配置。 |
| `buttonGroup` | `button-group` Unit 的按钮列表、选择模式、默认激活项和共享原生外观。 |
| `indicator` | 仅 `cycled`：可选 `onFunctionIds` 指示灯，见下文。 |
| `composite` | 平铺的原生 Text/Icon/Image/Button 模板、能力要求和 Button 配置声明。 |
| `defaultData` | 创建 Unit 实例时的默认数据。 |
| `platforms` | Unit 支持的平台，使用 `win32`、`darwin`、`linux`。 |
| `libraryUUID` | Unit 所属 Library。省略时使用 payload 中第一个 Library。 |

`defaultActivation` 的结构如下：

```ts
interface PluginUnitDefaultActivationConfig {
  mode: 'tap' | 'hold'
  holdDurationMs?: number
}
```

接受的默认激活形式为 tap 的 `{ mode: 'tap' }`，以及 hold 的 `{ mode: 'hold' }` 或 `{ mode: 'hold', holdDurationMs }`。省略 `holdDurationMs` 时，宿主使用 800 毫秒；显式提供时，值必须在 300–3000 毫秒之间，并使用 100 毫秒步进。`defaultActivation` 只能用于可点击的 Unit；`standard` 和 `custom` Unit 需要同时声明 `interactionMode: 'click'`，`display` 和 `continuous` Unit 不能声明它。

下面的定义让新建的 Start Commercial Unit 默认需要按住 800 毫秒确认：

```ts
{
  unitId: 'start-commercial',
  typeId: '@aspen/plugin/start-commercial',
  name: { default: 'Start Commercial', translations: { zh: '开始广告' } },
  categoryId: 'streaming',
  icon: 'mdi-advertisements',
  hasFunctionEditor: true,
  hasAppearanceEditor: false,
  hasView: false,
  visibleInLibrary: true,
  libraryUUID: '@aspen/plugin-twitch-creator-tools/creator-tools',
  platforms: ['win32', 'darwin', 'linux'],
  plugin: {
    type: 'standard',
    pluginUUID: '@aspen/plugin-twitch-creator-tools',
    pluginVersion: '1.0.0',
    unitId: 'start-commercial',
  },
  interactionMode: 'click',
  defaultActivation: { mode: 'hold', holdDurationMs: 800 },
  defaultData: { schemaVersion: 1, durationSeconds: 30 },
}
```

这个默认值只在用户从 Library 新建 Unit 时写入 `unit.config.activation`，不会改写已有 Unit。创建后，用户可以在宿主的交互设置中改成 tap、调整长按时长或恢复其他受支持配置。插件必须只响应宿主发出的 canonical activation 事件；不要监听 raw pressed/released 并自行实现计时器，也不要把 activation 配置塞进 `defaultData`。

## Plugin Unit Metadata

```ts
interface PluginUnit {
  type: 'standard' | 'custom' | 'canvas' | 'cycled' | 'slider' | 'value-label' | 'label' | 'button-group' | 'panel' | 'chart' | 'composite'
  pluginUUID: string
  pluginVersion: string
  unitId: string
}
```

| 字段 | 说明 |
| --- | --- |
| `type` | Unit 类型：`standard`、`custom`、`canvas`、`cycled`、`slider`、`value-label`、`label`、`button-group`、`panel`、`chart` 或 `composite`。 |
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

## 宿主拥有的 Unit 行为：插件不要重复实现

以下内容由宿主统一提供，插件定义和编辑器**不应**自己实现：

- **通用设置组**：长按激活（`defaultActivation` / “启用长按激活”）、容器的“点击控件后保持打开”、文件夹的“点击后返回”等宿主通用设置，统一显示在 Unit 功能编辑区最下方的同一个分组里，行样式一致（标签、“?”帮助、靠右的开关）。插件编辑器不要再渲染这些开关或另做一个同名设置。
- **写入规范化与校验**：见 `frontend-bridge.md` 的“Unit 写入规则”。其中 `value-label` 的 `valueLabel`（`format` 必须恰好包含一个 `%[0][w][.d]f`，字面百分号写成 `%%`）和 `slider.format` 在编辑时就会被校验；`format` 模式的数值标签和滑块必须带上这些配置。
- **指示灯**：按钮组的指示灯由宿主绘制；`cycled` 的指示灯通过上面的 `indicator` 选择启用。

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
- `value-label` Unit 必须设置 `valueLabel`，不能设置 `functions`、`slider`、`label`、`buttonGroup` 或 `hasView: true`。
- `label` Unit 必须设置 `label`，不能设置 `functions`、`slider`、`valueLabel`、`buttonGroup` 或 `hasView: true`。
- `button-group` Unit 必须设置 `buttonGroup`，不能设置 `functions`、`slider`、`valueLabel`、`label`、布局 `appearance` 或 `hasView: true`。
- `composite` 必须提供 `composite`，不接受其它类型配置、`hasView: true`、`hasAppearanceEditor: true` 或 Unit 级 hold 激活。
- 其它 Unit 类型不能携带不属于自身类型的 `functions`、`slider`、`valueLabel`、`label`、`buttonGroup` 或 `composite` 配置。

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
## Plugin cycled、slider、value-label、label 与 button-group Unit

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
  | 'button-group'
  | 'panel'
  | 'chart'
  | 'composite'
```

`PluginUnitDefinitionRuntime` 额外支持：

```ts
interface PluginUnitDefinitionRuntime {
  layouts: PluginUnitLayoutsV1
  functions?: PluginUnitDefinitionCycledFunction[]
  slider?: PluginUnitDefinitionSliderConfig
  valueLabel?: PluginUnitDefinitionValueLabelConfig
  label?: PluginUnitDefinitionLabelConfig
  buttonGroup?: PluginButtonGroupDefinition
  composite?: PluginCompositeDefinitionV1
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

interface PluginButtonGroupDefinition {
  presentationVersion: 1
  buttons: PluginButtonGroupButtonDefinition[]
  selectionMode?: 'single' | 'multiple'
  mandatory?: boolean
  displayMode?: 'title-only' | 'icon-only' | 'icon-left' | 'icon-top'
  defaultActiveButtonIds?: string[]
  background?: BackgroundStyle
  foregroundColor?: string
  fontFamily?: DeviceFontReferenceV1
  fontSize?: DeviceFontSizeTierV1
  iconSize?: DeviceIconSizeTierV1
}

interface PluginButtonGroupButtonDefinition {
  buttonId: string
  name?: PluginDisplayText
  icon?: string
  data?: Record<string, unknown>
}
```

### layouts：Unit 自有设备布局

原始注册声明必须提供 `layouts.default`。`createUnitTemplate()` 在未传入布局时生成 1×1 的默认布局；需要设备差异时明确声明：

```ts
layouts: {
  default: { preferredSize: { width: 1, height: 1 } },
  devices: {
    Flow2Pro: { preferredSize: { width: 1, height: 1 } },
    FlexbarV2: {
      preferredSize: { width: 2, height: 1 },
      appearance: {
        elements: [{ identifier: 'primary-text', geometry: { x: 35, y: 10, width: 60, height: 80 } }],
      },
    },
  },
}
```

选择规则为 `layouts.devices[deviceModelId] ?? layouts.default`。设备预设独立使用，不继承另一个设备或 default 的覆盖字段；省略的外观字段由该类型的共享内容模板提供。`preferredSize` 只含 width/height，均为 1–32 的整数，不包含页面位置。旧的 Unit 顶层 `defaultGeometry`、`appearanceOverride` 已移除。

每份布局支持：

- `appearance?: PluginAppearanceOverride`：复用原生外观覆盖类型。按 `identifier` 匹配现有元素；新增槽位必须提供完整 Element。跨设备使用相同标识，避免按数组位置或标题匹配。Chart 每份布局都必须提供完整外观。
- `buttonGroup?: { displayMode?, fontSize?, iconSize? }`：仅 Button Group，按钮列表、业务数据和状态仍放在顶层 `buttonGroup`。
- `presentation?: Record<string, unknown>`：仅 Custom/Canvas，写入已有 Unit data，供插件现有绘制接口消费。只声明排版字段，实体绑定等业务字段放在 `defaultData`。

Composite 的共享 `composite.appearance` 定义功能槽位及 Button 内容；每份布局通过 `appearance` 修改对应槽位的 geometry、字号、图标档位和 `data.layout`。省略的 Button 字号由宿主现有像素尺寸初始化规则计算，显式档位不会被覆盖。Panel 仍由平台生成内部排版，只声明首选占位。

新建、库预览和跨设备 Page 转换共用布局选择。新建使用完整目标外观；转换只调整现有匹配元素的排版和外部尺寸，保留 UUID、动作、配置、状态数、文字、颜色和额外元素，不恢复已删除的可选元素。目标设备没有预设时使用 default；插件定义缺失时保留内部外观，使用通用几何适配。

`cycled.functions[].appearanceOverride` 仍用于各状态的内容和样式。宿主在构建状态外观后统一应用所选设备排版。`value-label` 和 `label` 的 primary text / primary icon 仍是设备端运行时元素。

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
          { identifier: 'primary-text', data: { text: 'Play' } },
        ],
      },
    },
    {
      functionId: 'pause',
      name: 'Pause',
      data: { command: 'pause' },
      appearanceOverride: {
        elements: [
          { identifier: 'primary-text', data: { text: 'Pause' } },
        ],
      },
    },
  ],
})
```

规则：

- `functions` 必填，且至少包含两个函数。
- 每个函数必须有稳定且唯一的 `functionId`。
- 前端不能新增、删除或排序函数。
- 用户可以通过宿主已有外观编辑器修改每个函数的外观。
- 函数外观不是 `data` 的一部分；运行时结构与内置 `cycled-key` 保持一致。
- 插件函数编辑器通过 bridge 读取和写入当前选中函数的 `data`。

设备点击 plugin `cycled` Unit 时，宿主不会自行切换状态。插件业务处理成功后调用 `hostApi.unit.setFunction(serialNumber, unitUuid, functionId)` 更新设备状态；失败时应使用通知 API 报错。

#### 可选的指示灯 `indicator`

`cycled` 定义可以声明 `indicator: { onFunctionIds: ['on'] }`，列出哪些函数表示“开”。声明后，宿主在当前状态的外观之上叠加与按钮组相同的指示灯线：当前函数在列表中时为绿色，否则为暗色；位置与按钮组相同（Flexbar 左边缘竖线，Flow2Pro 底部居中横线），预览与设备出图使用同一条渲染路径。要求：

- `onFunctionIds` 非空、不重复，且每个 ID 必须是该 Unit `functions` 中的 `functionId`；只允许用于 `cycled`。
- 不声明时 Unit 的渲染与之前完全一致，内置 Cycled Key 也不受影响。
- 如果某个 Unit 实例的函数里没有任何“开”函数（例如循环切换多个选项的紧凑选择器），宿主不绘制指示灯，避免出现一直暗着的误导。

### button-group

`button-group` 适合输入源、模式或过滤条件的单选／多选状态组。每个按钮由设备原生 Button 绘制，名称、图标和业务数据按按钮保存，字体、背景和布局全组共享。

```ts
const inputSourceUnit = {
  unitId: 'source', typeId: '@acme/media/source', name: 'Input Source', categoryId: 'media',
  plugin: { type: 'button-group', pluginUUID: '@acme/media', pluginVersion: '1.0.0', unitId: 'source' },
  hasFunctionEditor: true,
  buttonGroup: {
    presentationVersion: 1,
    selectionMode: 'single', mandatory: true, displayMode: 'icon-left',
    background: { backgroundColor: '#111827', borderColor: 'transparent', borderWidth: 0, borderStyle: 'none', borderRadius: 6 },
    foregroundColor: '#ffffff', fontFamily: 'builtin:font:puhuiti', fontSize: 20, iconSize: 24,
    defaultActiveButtonIds: ['hdmi'],
    buttons: [
      { buttonId: 'hdmi', name: 'HDMI', icon: 'builtin:icon:video-input-hdmi', data: { source: 'hdmi' } },
      { buttonId: 'usb', name: 'USB', icon: 'builtin:icon:usb', data: { source: 'usb' } },
    ],
  },
}
```

- `presentationVersion: 1` 必填；至少两个按钮，`buttonId` 非空、唯一且无首尾空白。
- `selectionMode` 默认为 `single`，也可用 `multiple`。`mandatory` 默认为 `true`；未指定默认项时选第一个按钮。显式默认项必须存在；单选最多一个，mandatory 不接受空列表。
- `displayMode` 默认为 `icon-left`。四个值分别是 `title-only`、`icon-only`、`icon-left`、`icon-top`，与 Composite Button 的布局相同。
- `background` 支持完整背景、边框和圆角；`foregroundColor`、设备字体及字号档位全组共享。可用字体和档位见下方 Composite 约束。未指定字号时只在放入实际设备尺寸后初始化一次；拖动尺寸不会自动改写已保存字号。
- 激活值由宿主统一指示灯表示，手指按压反馈和业务选择状态相互独立。组根部不叠加整 Unit 按压／长按反馈。
- 顶层及逐按钮均无 `appearanceOverride`，没有逐按钮 appearance 数组，也不提供 `hasView` 或 `hasAppearanceEditor`。宿主编辑器拥有共享外观；名称／图标在按钮列表编辑，业务配置通过所选按钮的 `pluginData` 编辑。
- 按钮名称可本地化；图标使用已支持的 `builtin:icon:<mdi-name>`，不接受任意图片或 emoji。

运行时仍使用 `getButtonGroupState(serialNumber, unitUuid)`、`setButtonGroupState(serialNumber, unitUuid, activeButtonIds)` 和 `changed` 事件。复用原生 Button 绘制不会把按钮组改成 Composite，也不会改变它的即时选择行为；详情见 [Host API](./host-api-reference.md#button-group-状态更新)。

按钮组的每个按钮都有一条“指示灯”线（位置与 Agent 面板功能按钮相同，来自宿主唯一的几何来源：Flexbar 左边缘竖线，Flow2Pro 底部居中横线）。按钮处于激活状态时为绿色，关闭时为低对比度暗色；按钮表面保持统一，选中状态只由指示灯表达。颜色是宿主固定的一对常量，插件不设置，也不要在 `appearance` 里再画一条线或用填充色表示选中。预览与设备出图使用同一个宿主视图。

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

`value-label` 是插件控制的数值显示 Unit。它没有 slider 的激活态和拖动事件；插件只需要在后端发送数值或数值型字符串，设备端使用 Native Text 按声明字符集生成的字体子集本地绘制 primary text，因此不需要用 `custom` 或 `canvas` 实时推图。

`value-label` 有两种模式：

- `format`：`format` 必填，使用一个 C-style `%f` 数字占位符，例如 `%0.1f C`。运行时只接受有限 `number`；宿主格式化后把最终 `displayText` 发给设备。charset 自动由 `0123456789.-` 加 format 字面量生成，忽略 `customCharacters`。
- `custom`：运行时接受 `number | string`。charset 由 `0123456789.` 加用户声明的 `customCharacters` 生成；最多允许 128 个去重后的自定义 grapheme。运行时文本中字体子集缺失的字符不会导致更新失败，设备端显示方框占位。

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
- 不能同时声明 `functions`、`slider`、`label` 或 `buttonGroup`。
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
- 不能同时声明 `functions`、`slider`、`valueLabel` 或 `buttonGroup`。
- 不能设置 `hasView: true`。
- primary text 的字体族被锁定为定义里的字体；字号、颜色、粗体、斜体等外观仍可编辑。
- primary text 和 primary icon 由设备端运行时绘制；预渲染 PNG 不包含这两个元素。
- `label` 不新增设备端 `changed` 事件。插件通过 `hostApi.unit.setLabelText()` 和 `hostApi.unit.setUnitIcon()` 主动更新设备显示。
<!-- plugin-cycled-slider:end -->

## composite：平铺原生复合 Unit

一个 Composite Unit 在同一外观中平铺 `text`、`icon`、`image`、`button` 元素。它适合一个业务对象的组合控制，例如空调的温度、加减键、电源和模式；元素顺序同时决定绘制层次。只有 Button 接收元素事件，装饰元素不截获点击；Button 以外的区域仍可触发 Unit 自身的 tap。

定义使用 `plugin.type: 'composite'` 和 `composite: { requires: { host: 1, device: 1 }, appearance, buttonConfigs? }`。宿主／固件必须支持 Composite v1，能力不足明确拒绝；插件不提供 iframe 运行视图或第二份画布。保存实例使用既有 `appearance[0].elements`，不保存嵌套容器或运行时 overlay。

### 空调模板

下面的模板由一个温度 Text、两个可连发 key、一个 toggle 和一个 cycled Button 组成。`identifier` 是插件稳定逻辑名称；模板可以省略 UUID，由宿主在插入、复制和转换时分配实例身份。运行时先读已部署快照，通过 identifier 找到实际 UUID。

```ts
const surface = { backgroundColor: '#242424', borderColor: 'transparent', borderWidth: 0, borderStyle: 'none', borderRadius: 6 }
const nativeButtonStyle = { background: surface, foregroundColor: '#ffffff', fontFamily: 'builtin:font:puhuiti' }
const keyButton = (identifier, icon, x) => ({
  typeId: 'button', identifier, config: { removable: false, visible: true, enabled: true },
  geometry: { x, y: 0, width: 20, height: 50, rotate: 0 }, style: nativeButtonStyle,
  data: { layout: 'icon-only', icon, title: '', interaction: { mode: 'key', repeat: { delayMs: 500, intervalMs: 100 } } },
})
const climateUnit = {
  unitId: 'climate', typeId: '@acme/hvac/climate', name: 'Climate', categoryId: 'home',
  plugin: { type: 'composite', pluginUUID: '@acme/hvac', pluginVersion: '1.0.0', unitId: 'climate' },
  composite: {
    requires: { host: 1, device: 1 },
    appearance: { background: surface, elements: [
      { typeId: 'text', identifier: 'temperature', config: { removable: false, visible: true, enabled: true },
        geometry: { x: 20, y: 0, width: 60, height: 50, rotate: 0 },
        style: { background: surface, backgroundColor: 'transparent', color: '#ffffff', fontFamily: 'builtin:font:ds-digital',
          fontSize: 28, fontWeight: 'normal', fontStyle: 'normal', textAlign: 'center', textShadow: '' },
        data: { text: '24' } },
      keyButton('decrease', 'builtin:icon:minus', 0),
      keyButton('increase', 'builtin:icon:plus', 80),
      { typeId: 'button', identifier: 'power', config: { removable: false, visible: true, enabled: true },
        geometry: { x: 0, y: 50, width: 50, height: 50, rotate: 0 }, style: nativeButtonStyle,
        data: { layout: 'icon-left', icon: 'builtin:icon:power', title: { default: 'Power', translations: { zh: '电源' } },
          interaction: { mode: 'toggle' }, initialStateId: 'off',
          states: [{ stateId: 'off', overrides: {} }, { stateId: 'on', overrides: { foregroundColor: '#66bb6a' } }],
          indicator: { litStateIds: ['on'] } } },
      { typeId: 'button', identifier: 'mode', config: { removable: false, visible: true, enabled: true },
        geometry: { x: 50, y: 50, width: 50, height: 50, rotate: 0 }, style: nativeButtonStyle,
        data: { layout: 'icon-top', icon: 'builtin:icon:fan', title: 'Mode', interaction: { mode: 'cycled' }, initialStateId: 'auto',
          states: [{ stateId: 'auto', overrides: { title: 'Auto' } }, { stateId: 'cool', overrides: { title: 'Cool' } },
            { stateId: 'dry', overrides: { title: 'Dry' } }] } },
    ] },
    buttonConfigs: [{ identifier: 'power', settings: { scene: { type: 'text', label: 'Scene', default: 'living-room' } } }],
  },
}
```

### 元素与外观约束

- 几何值仍为 Unit 百分比；正宽高、`rotate: 0`。Button 不嵌套元素。`config.removable: false` 标记必需槽；全 Unit 写入也不能删除或解锁它。
- Button 的 `data.layout`：`title-only`、`icon-only`、`icon-left`、`icon-top`、`none`。`none` 隐藏内部标题和图标，可配透明背景形成独立热区；普通按钮组不提供该模式。设备在内部固定布局图标和标题；不用额外 Icon/Text 元素模拟按钮内容。
- 字体仅 `builtin:font:puhuiti`、`builtin:font:consola`、`builtin:font:ds-digital`；字号档位为 `18, 20, 24, 28, 32, 40, 48`，图标档位为 `20, 24, 28, 32, 40, 48`。Icon 的 `style.fontSize` 使用图标档位。Composite 的 Text/Icon 不支持阴影，`textShadow` 必须为空字符串；Text 不支持粗体、斜体或自动字号。
- 图标仅使用受支持的内置 MDI 引用。所有公开元素字符串拒绝内嵌 NUL。Image 及背景图片只能引用已随部署验证的资源；运行时不能装载任意 URL、本地文件或新图片。
- Button 模板可省略 `fontSize`／`iconSize`，由宿主在实际插入尺寸上初始化一次。用户明确修改字号或点“重算字号”才改写档位，画布缩放和尺寸拖动不隐式重算。
- 模板 Text 文本、Button 标题、状态标签及状态覆盖标题接受 `PluginDisplayText`，在创建实例时本地化；保存和运行时值是字符串。模板源不会成为运行时可变状态。

### 模板 Image 与资源闭包

Image 元素与背景图片引用 `asset:<assetId>`。如果该资源不在新项目中，定义必须随 `composite.resources` 提供完整资源包，不能只写一个看起来合法的 UUID。它复用 SDK 导出的 `CompositeTemplateResourcesV1`、`ThemePackageV1`、`AssetRecordV1` 与 `BlobRecordV1`：

```ts
interface CompositeTemplateResourcesV1 {
  embeddedTheme: ThemePackageV1
  blobBytes: Record<`sha256:${string}`, string>
}
// embeddedTheme 必需结构；assets/blobs 来自已验证的图像导入结果。
const resources: CompositeTemplateResourcesV1 = {
  embeddedTheme: {
    schemaVersion: 1, kind: 'theme', profile: 'embedded',
    themeUUID, revision: 1,
    metadata: { name: 'Climate images', authorName: 'Acme', modifiedAt },
    core: { variables: {}, assetCategories: [], assets, unitStylePresets: [] },
    deviceVariants: [], migrationPolicies: [], blobs,
  },
  blobBytes, // blobHash -> canonical raw base64
}
```

每个 image Asset 包含 `assetId`、`name`、`modifiedAt`、`blobHash`、`contentFingerprint`、`origin: 'embedded-theme'`、`kind: 'image'`，以及真实解码得到的 `renderParameters: { profile: 'rgba8-srgb-v1', width, height, frameDurationsMs, loopCount }`。每个 Blob record 包含 `blobHash`、`byteSize`、真实 `mimeType`、`filename` 和 `present: true`。UUID、UTC 时间、SHA-256、render fingerprint 与字节必须互相匹配；fingerprint 是解码内容的摘要，不能直接拿文件 SHA-256 代替。

`blobBytes` 的键为 `sha256:` 加 64 位小写十六进制摘要，值是标准填充的 base64，不带 data URL 前缀或空白。只允许 image 资源；Theme 变量、分类、样式预设、设备 variants、迁移策略均为空。声明中的每项资源必须属于模板外观的引用闭包。上限为 32 个 Assets、32 个 Blobs、每 Blob 4 MiB、总计 8 MiB；解码检查限制为 4 Mi 像素和 256 帧。

定义校验检查 schema、字节长度、SHA-256、canonical base64 与引用闭包。主进程库枚举和最终项目提交另用既有资源检查器验证真实 MIME 与解码 fingerprint。插入与 `convertUnit` 使用同一资源复制 owner，按内容去重并改写引用，与 Unit 作为一次可撤销提交；失败保留原项目。`setUnit` 和 `setUnitData` 校验真实项目内的引用，不允许悬空资产。上传后 Image 只读取该部署包已有资源，运行时事务不上传图片。

完整、可验证的图像声明见 FlexPluginFullTest 的 `src/shared/composite-fixture-v1.json`；不要把示例 UUID 或机器路径作为资源输入。

### 状态和配置

`key` 没有业务状态，可配置 `interaction.longPress: { thresholdMs }` 和 `repeat: { delayMs, intervalMs }`。长按或连发已触发时，释放不再产生 activate。`toggle` 必须有两个状态，`cycled` 至少两个；两者不接受长按／连发。状态项由稳定 `stateId`、可选 `label` 和 `overrides` 组成，覆盖仅含 `icon`、`title`、`foregroundColor`、`background`。`initialStateId` 和 `indicator.litStateIds` 都必须引用已有状态。

toggle／cycled 激活先发出带 `requestId` 和目标 `stateId` 的 activate，保留最后确认值并进入 pending。插件完成业务请求后用 `setState` 确认真实状态，或报告 failed；设备不以乐观切换冒充业务成功。pending 期间不接收新的业务请求，过期确认不能清掉较新的请求。按压反馈、pending 提示、确认状态和离线提示分别表达不同事实。

`composite.buttonConfigs` 复用宿主标准 settings 表单；每条声明以 `identifier` 或 `mode` 二选一限定 Button。模式通用字段与 identifier 字段可以合并，但不能重名覆盖。实例配置保存在 `unit.data.buttonConfigs[buttonUuid]`，删除／复制 Button 与配置在一个草稿操作中完成。插件运行时通过 `getButtonConfigs(target)` 读取已确认部署的主机私有配置；它不下发到设备，不从当前编辑稿回退。运行时创建的 Button 没有保存配置。

Composite 使用宿主高级编辑器编辑平铺元素、布局、状态与配置；基础外观保留背景。Theme Replacement、样式复制／粘贴不会修改 Composite。Apply/Cancel、撤销／重做沿用 Project 草稿历史；预览状态切换不保存，也不执行插件业务动作。插件缺失时保留可见只读初态和资源。

运行接口见 [Composite Runtime API](./host-api-reference.md#composite-runtime-api)，后端订阅与确认示例见[后端运行时](./backend-runtime.md#composite-订阅与业务确认)。

## panel：平台原生 Agent Panel

`plugin.type: 'panel'` 声明使用 FlexStudio/设备提供的通用 Agent Panel。Codex、Claude 等适配器提供会话数据、业务请求和动作执行结果；宿主与固件负责 UI、布局、绑定编辑、导航、翻页、焦点、长按确认与超时。插件不实现 Panel iframe、外观编辑器或渲染器，布局只声明 `preferredSize`，不声明 `layouts.*.appearance`、`availableElements`、`hasView`、`hasAppearanceEditor`、`interactionMode`、`defaultActivation`。`hasFunctionEditor` 仅用于排序、快捷回复等业务设置。

```ts
this.createUnitTemplate({
  unitId: 'monitor', typeId: '@demo/monitor.panel', name: 'Agent monitor', categoryId: 'plugin',
  plugin: { type: 'panel', pluginUUID: this.pluginUUID,
    pluginVersion: this.pluginVersion, unitId: 'monitor' },
  panel: { staleAfterMs: 30000, sessionCatalogMethod: 'listSessions' },
  hasFunctionEditor: true,
})
// 注册普通 renderer RPC；平台负责选择控件和持久化。
this.registerRendererRpc('listSessions', (query: string, selectedIds: string[]) => ({
  items: [{ id: 'session-stable-id', title: 'Example session' }],
}))
```

目录 RPC 接收 `[query, selectedIds]`，返回 `{items: Array<{id, title}>}`。返回当前查询匹配项及已选择项；ID 必须是稳定会话身份，不随请求变化。目录失败不清除已保存绑定；未实现目录的适配器仍可使用自动会话选择。`exampleModel` 可提供符合模型约束的合成示例，不放真实会话、账户或运行快照。

### 单 Session 元素与高度适配

新 Panel 默认三个 `panel-session` 元素；用户可在高级编辑器添加、复制、删除、拖动和缩放，沿用现有最多 8 个会话槽的限制。每个元素保存自身 UUID、百分比几何和 `{view:'overview', slot, itemId?, itemTitle?}`。固定绑定跟随元素，删除中间元素不会改变其他绑定，复制元素分配新槽并恢复自动选择。缺失的固定会话显示禁用占位，不用另一个会话代替。

元素内部的标题、状态、计时、进度和活动布局由平台编译器生成。预览和上传调用同一编译器；设备消费相同的像素矩形，整个 Session 是一个编辑与点击区域。详情、通知、返回和动作由平台生成，详情/通知标签用于预览，没有可编辑的内部字段。高度适配仅在 Agent Panel 内部：60px 采用紧凑两行，134px 采用三行；不新增面向所有 Unit 的响应式布局协议。

两种高度的 Session 顶行均合并状态与当前操作，只在 active/attention 时显示操作；success/error/idle/disabled 不追加旧动态。Flow2Pro 第三行使用与状态相同的小字号显示 `subtitle`；Codex 插件将其绑定为最近一条非空助手文字消息的有界摘要，与工具输出和项目目录分开。没有消息时留空。Flexbar 保持两行，不增加第三行。

旧分离字段按已有 slot 做一次输入迁移，保存该组矩形并转换旧 `sessionBindings`。运行时不再从字段推断会话。旧布局中复用同一 slot 的多个区域无法恢复成不同会话，需显式新增 Session；已初始化后删除全部 Session 不会自动补回三个。升级需要匹配的宿主、SDK 与固件；设备需公布 `capabilities.pluginPanel: {version:1, sessionElements:2}`。仅有 `version:1` 的旧固件不具备新元素能力，宿主显示更新提示。

### 数据、输入与业务动作

`hostApi.unit.getPanelBindings(serialNumber, unitUuid)` 返回 `{elementId, slot, itemId?, title?}[]`。插件据此获取固定目标数据，但不能重排或写回元素。发布时以固定会话 ID 作为 `item.id`，即便底层请求 ID 改变。使用 `hostApi.unit.setPanelModel` 或基类 `setPanelModel` 发布；Host 拒绝 `navigation` 和 `item.slot`，布局与 slot 投影由平台完成。`layout:'sessions'` 属于内部设备表示，插件无需设置。

运行绑定来自宿主在部署时生成的 `data.panel.bindings` 快照，并随设备已有的 Unit 加载描述返回。插件不要修改这个字段；本地尚未上传的编辑不会影响设备运行绑定。Panel 加载和后续事件都保留设备加载描述中的运行数据，不使用本地项目数据覆盖。

模型包含 `v:1`、`items`，以及可选的 `notice`、`noticeIcon`、`defaultItem`、`staleAfterMs`、数据窗口 `pagination`。条目包括稳定 `id`、`title`、语义 `state`、`pages`，可提供 `activity`、`subtitle`、`stateText`、`badge` 和 `timer`。`timer.since` 是 Unix 毫秒；`elapsedMs` 冻结已完成时长。状态为 idle/active/attention/success/error/disabled。页面表示业务内容或请求，包含 `id`、`lines`、`actions`，可提供 `title`、`timer`、`progress:[完成数,总数]`；`layout:'decision'` 是现有请求语义标记，不提供坐标或布局模板。

动作提供 `id`、完整 `label`、可选 `description`、语义样式 normal/primary/danger、`enabled`、`confirm:'hold'`、`requireFullLabel`；外部打开动作使用 `icon:'open-in-new'`。旧 `priority` 不再让原生 UI 静默省略动作，所有已提供动作由平台分页。点击详情内容切换剩余动作/下一业务页。会话和页面标题允许截断，不影响动作可用性；`panel-lines` 正文保留全部已提供文字，自动换行并在原区域内纵向滚动，滑动不会触发点击，当前页面刷新时保留滚动位置。请求正文存在但没有可阅读的正文区域、决策按钮自身文字仍放不下、数据过期或动作明确禁用时不可执行；外部打开动作仍可用于查看原请求。

决策页（`layout:'decision'`）将本页全部动作排入共用布局，复用已配置动作元素的样式，不以模板动作槽数量截断审批选项；普通详情页仍按动作槽分页。最后一个动作显式使用 `style:'normal'` 且没有 `icon` 或 `confirm` 时，按既有跳过按钮样式布局。Panel 外层透明且无边框，内部会话卡片及动作按钮统一使用深灰色（#242424）圆角底板和色条：Flow2Pro 色条位于底部居中，Flexbar 色条位于左侧居中。默认动作和辅助按钮采用设备主题色，不同业务选项使用不同色条。跳过、返回和外部打开保持全高，Flow2Pro 宽 0.5U，Flexbar 宽 2U；U 按设备 cellWidth 计算。跳过、返回和外部打开均显示 MDI 图标，决策选项按顺序显示 MDI 数字图标。所有动作按钮按内容测量宽度，最小宽度与辅助按钮相同（Flow2Pro 0.5U、Flexbar 2U）；短文案不等分拉伸，长文案获得剩余空间。字号上限为系统按钮默认值（Flow2Pro 20px、Flexbar 16px），仅在内容放不下时缩小，仍不完整的决策不可执行。色条粗细、长度、边距和圆角以设备为基准固定，不随按钮宽度变化。Flow2Pro 保留统一图标区域，标题从相同高度开始；Flexbar 图标与标题横排垂直居中。默认 Panel 宽度同时容纳三个选项、跳过、返回及问题内容，旧自定义几何不自动扩宽。所有详情页的外部打开动作紧邻“返回”左侧，有“跳过”时放在外部打开左侧；普通业务动作使用其余空间。外部打开按 icon 语义优先进入第一动作窗口，显示位置靠右，动作身份不变。 例如三个答案后追加“跳过”；插件区分空答案与选择答案，不能将跳过文案作为答案提交。其他动作继续使用平台分页。

概览不显示右侧状态栏，也不再提供 `panel-more` 元素，Session 使用全部可用宽度。自动会话使用连续横向滚动：跟随手指移动，松手后由平台 LVGL 惯性减速，不按页跳转，也不首尾循环。固定绑定保持原位。到达已加载内容边缘时，通过既有 `browse` 事件及 `pagination` 请求相邻重叠窗口；返回数据后按会话 ID 保留可见位置，不新增插件 API。单次触摸移动达到 8px 即永久取消本次点击和长按；再次按下只中断惯性，下一次明确点击才能打开会话。渲染和点击命中使用同一滚动位置；触摸及惯性期间不重建节点树。

现有设备协议容量不变：模型最多 12288 字节、8 个条目、每条目 8 页、每页 4 个动作/4 行，文字最多 240 UTF-8 字节；ID 不含 NUL，事件含身份/token 后不超过 1024 字节。非法/超限输入发送前拒绝。Codex 对超过三个选项的问题保留“在 Codex 打开”业务动作，不在插件内拆成显示分页；这保留了完整桌面答题路径，但当前不支持在设备逐项回答这些大问题。

平台补入 `layout`、固定会话 `slot` 和缺失目标占位后，按最终 JSON 的 UTF-8 字节数控制下发容量；插件无需猜测或预留固定数量的字节。临界大小模型优先缩短会话标题、摘要和页面标题等展示字段，不截断请求正文、按钮文案、动作 ID 或审批参数。仍然放不下时，只缩小自动会话窗口的末尾，并保留正确的 `pagination`，由既有 browse 事件读取后续会话；固定会话不被替换。若保留固定会话和至少一个自动会话后仍无法完整传输，则返回 `panel-presentation-budget-exceeded`，不发送残缺决策。源模型及插件保存的待处理队列不受影响。

旋钮等目标功能调用 `hostApi.unit.sendPanelInput(sn, uuid, input)`，其中 input 为 `{kind:'rotate',delta}`、`{kind:'press',down}` 或 `{kind:'cancel'}`。激活取消时也发送 cancel。平台拥有触摸与旋钮共同使用的选择状态，插件不根据按键直接执行 Panel 审批。接到 `onPanelEvent` 的 action 后重新校验请求、动作、权限与有效期，执行业务并用 `ackPanelAction` 返回结果。陈旧/断线/notice 状态不可执行；更新请求或改变选中目标使按压确认失效。5 秒空闲后允许自动介入，30 秒聚焦空闲返回概览，10 秒未收到动作回执显示未知；未知结果不得自动重放。

`getPanelBindings`、`sendPanelInput`、`setPanelModel`、`ackPanelAction` 都要求 `unit` 权限，并检查插件对已加载 Unit 的所有权。输入按顺序发送，不进入合并最新模型的队列。

### 公共外观编辑与历史

普通多状态 Unit 继续通过已有 `appearance[]` 和公共接口编辑，插件暂不可用时也保留数据。`unitAppearanceTargets`、`unitAppearanceElements`、`updateUnitAppearance`、`arrangeAppearanceElements` 从 `@flexsdk/runtime` 导出；Panel 概览的元素也是现有文档数据。切换预览视图不修改运行状态和历史；显式排列、几何修改、增加/删除与绑定修改共用原有草稿和 Apply/Cancel、撤销/重做。模型更新不写文档。只有初始化或显式“重置布局”创建三个默认会话，不在渲染过程中修改元素。

## label / value-label 状态与交互

label/value-label 点按和长按事件交给插件处理；不声明 tapAction，不提供 Target Page。设备页面导航使用独立的 PageJump Unit。旧插件应在 migrateUnit 中删除废弃的 tapAction 数据。

setUnitState 给 label/value-label 的动态文字和图标应用固定语义色，不提供任意运行时颜色 API。state 的取值与面板相同。label 的原有文字、图标 API 继续使用；不要把动态文字或完整模型保存进 Project。

面板可提供 `pagination: { offset, total }`，items 只承载当前窗口。设备浏览完当前窗口后发送 `{ event: "browse", offset }`；插件从完整数据源投影下一窗口，不能按显示容量丢弃待处理请求。分页事件不执行业务操作。

## 原生插件 Chart Unit（SDK 2.2）

`plugin.type: 'chart'` 为插件专用原生图表 Unit。它使用与内置 Chart 相同的六种元素、样式、数据订阅、设备推送、字体构建和固件渲染器：`chart-text`、`chart-gauge`、`chart-progress-bar`、`chart-line`、`chart-series-bar`、`chart-heatmap`。静态 text/icon/image 可以一起组成默认布局。

文字优先使用 `builtin:font:puhuiti` 或 `builtin:font:consola`。这两个引用直接复用设备内置字体，不生成字体子集，也不随项目重复传输字体文件。预览使用相同字体和原生渲染规则。自定义字体仍通过项目资源和子集部署；不会仅凭字体名称替换。`chart-text` 和 `status-count` 的文字背景应为透明、无边框，Unit 的底色和轮廓放在 `appearance.background`，不要把 Unit surface 复制到文字元素。

- 每份布局必须提供 `appearance`，并绑定 `plugin:<pluginUUID>:<sourceId>:<entryKey>` 数据源。不要声明 iframe `hasView` 或 `hasAppearanceEditor`，也不要附加 canvas/functions、slider、label 或 button-group 运行时配置。
- 使用已有 `chart` 权限、`registerChartDataSource`、`publishChartEntries`。不新增图片推送协议。设备通过现有 load/unload 和 rawEvent（touch、long-pressed）通知插件。
- `layouts.default.preferredSize: {width: 3, height: 1}` 指定默认格数，设备专用值放在对应的 `layouts.devices[model]` 中。添加和显式跨设备 Page 转换共用该偏好；普通加载不会改变已保存布局。
- 多实例数据源可在元素 `dataSourceKey` 或 line `sources[].key` 中使用 `{unitUUID}`，Studio、设备和字体收集均按当前 Unit UUID 解析。共享指标不必按设备 load 才发布，这样新建 Unit 在编辑器中也能显示真实数据。
- gauge 可声明 `style.thresholds: [{max: 5, color: '#EF5350'}, {max: 20, color: '#FFB74D'}]`，按满足 displayValue <= max 的最小 max 选色，其他数值使用 style.color；最多 8 条。与内置 Chart 共用语义。
- 使用 `migrateUnit` 将旧类型迁移为 chart 时，返回 `{unit}`，一次性更新 plugin、appearance、config，保留 Unit UUID、位置和尺寸，并给新元素分配唯一 UUID。不要只改 type 而保留空布局。

本能力需要同步支持 chart 类型的 FlexStudio 和固件；只升级 SDK 不能让旧固件识别新 Unit。完整示例见 FlexPluginFullTest 的 native-chart 定义及 runtime-load 数据源。

## 状态计数元素（SDK 2.3）

`status-count` 是一个可选择状态的原生文字元素，同一类型可放置多份。每个元素显示一行状态名称和数量；不使用图表外观或通用图表配置面板。它复用现有 `chart` 数据发布、设备文字绑定、字体构建和文字渲染，不新增推送通道。

- 状态展示 Unit 使用 `plugin.type: 'standard'`，由宿主的普通 Unit 视图和外观编辑器呈现；设置 `availableElements: ['status-count', 'text', 'icon', 'image']` 限定高级编辑器的元素面板，`layouts.default.preferredSize: {width: 1, height: 1}` 指定新建尺寸。只有需要图表元素的 Unit 才使用 `chart`，例如额度圆环。
- `availableElements` 适用于 `standard` 和 `chart`。显式指定时，`layouts` 中每份 `appearance.elements` 提供完整元素，宿主从空外观构建，不插入默认名称或图标元素，也不接受 primary 元素补丁；元素 UUID 必须唯一。普通 Unit 的面板和外观不能包含 `chart-*` 图表元素。省略该字段时保留原类型的默认外观构建规则。
- 动态计数复用 `chart` Host API 和既有设备数据协议；数据通道名称不决定 Unit 类型。宿主与固件按普通 Unit 实际包含的 `status-count` 元素启用数据消费，不依赖插件名称或业务 ID。断连、过期和来源移除显示 `--`，真实零值保留。
- 元素 `data` 为 `{dataSourceKey, updateInterval, options: [{label, dataSourceKey}]}`。`options` 的数据键唯一，当前选中键必须在其中。高级编辑器只显示状态选择器；插件自行决定状态定义，不在宿主硬编码业务状态。
- 同一组选项也放在 Unit 的 `defaultData.statusCountOptions`，供拖拽、双击新增元素使用。复制粘贴保留元素已有选项。
- 各数据源发布 `rawValue` 数量；状态名称由元素当前选项的 `options.label` 提供，宿主与固件将标签和数字组合为一行，例如 `Running 3`。不要将状态名称写入仅接受数值格式的 `displayText`；设备字体闭包合并所有可选标签与数字字符。语言改变后需要更新布局和文字域；使用设备内置字体时不重新上传字体文件，自定义字体按新字符域重新构建子集。
- `status-count` 保留为设备元素，沿用 `chart.text:<elementUUID>` 原生文字绑定，固件用同一文字渲染器识别它；旧固件不识别该元素，需升级匹配的固件。设备回读后仍能选择状态。
- 升级插件时通过 `migrateUnit` 将旧状态 Unit 改为 `standard` 并更新元素面板。已有 `status-count` 元素保留 UUID、样式和编辑；更早的统计布局需要转换时，给新元素分配 UUID。保留 Unit 的身份、位置和尺寸，并提升插件版本以触发迁移。

完整示例：FlexPluginFullTest 的 Status Count Probe；实际产品示例：Codex Agent status 的运行中、已完成、待处理三行。

### Chart 圆环的一致性

`chart-gauge` 与内置 Chart 共用渲染器。上位机和固件的圆环几何由工作区 `contracts/chart-render/v1/ring.json` 统一生成：按设备像素在元素内居中、等宽圆头线条、135° 起始角及 270° 扫角，背景透明度为 64/255。不依赖 SVG 私有轮廓或 LVGL 主题默认样式。此变更不增加插件配置字段；插件继续提供已有的几何、颜色、阈值和数据绑定。要得到一致的预览和实机效果，需要同时更新宿主与固件。
