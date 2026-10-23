# 插件 UI/UX 设计指导

本页给 agent 和插件作者提供通用的 FlexStudio 插件界面设计约束。它适用于插件配置页、Unit 功能编辑器、Unit 外观编辑器和自定义运行时视图。

涉及外部服务连接、真实 Catalog、Unit 任务划分或设备与外部状态同步时，先阅读[产品级插件设计指导](./product-plugin-design-guide.md)。本页只规定界面表现，不替代产品边界和状态架构设计。

目标不是让每个插件长得完全一样，而是让插件像 FlexStudio 的一部分：紧凑、清晰、可重复操作、状态明确，并且不会用装饰性元素干扰真实工作。

## 总原则

- 优先使用 Vuetify 3 组件，不要为了普通表单、按钮、列表、状态提示、弹窗或菜单重造组件。
- 插件 UI 默认跟随 FlexStudio 主题、字体、间距、阴影和圆角习惯。
- 默认主题色使用 FlexStudio 的 `primary` 蓝色。插件有明确的 app 或品牌主题时，可以使用该 app 的主题色作为 accent，但不要让整个界面变成单一品牌色背景。
- 用户可见信息必须有操作价值：配置、状态、诊断、错误、下一步动作或运行结果。避免纯描述性、营销式、占位式内容。
- 避免多层容器嵌套。普通插件页最多使用一层 `v-sheet` / panel 分组；Unit 编辑器通常直接使用宿主提供的外层编辑区域。
- 控件要密集但不拥挤。插件面板通常空间有限，应优先保证扫描和重复编辑效率。
- 所有用户可见文本都应走 SDK i18n（`createPluginI18n` / `usePluginI18n`）或高级自定义本地化层，不要在代码里硬编码中文或英文业务文案。

## Vuetify 组件约定

默认使用这些组件和 variant：

| 场景 | 推荐组件与样式 |
|---|---|
| 文本输入、URL、token 别名、短配置 | `v-text-field variant="solo-filled" density="compact"` |
| 多行输入 | `v-textarea variant="solo-filled" density="compact"` |
| 下拉选择 | `v-select` / `v-combobox`，`variant="solo-filled" density="compact"` |
| 开关 | `v-switch density="compact" color="primary"` |
| 二元选项 | `v-checkbox density="compact"` 或 `v-switch`，根据语义选择 |
| 小枚举模式 | `v-btn-toggle`，不要用一串自定义 div |
| 普通命令按钮 | `v-btn variant="tonal"` |
| 主要提交动作 | 可使用 `color="primary" variant="tonal"`；只有明确高优先级动作才用更强视觉权重 |
| 工具栏动作 | icon-only `v-btn` + `v-tooltip` |
| 状态标签 | `v-chip size="small" variant="tonal"` |
| 错误/成功/警告 | `v-alert variant="tonal" density="compact"` 或 host snackbar |
| 分组容器 | `v-sheet`，圆角不超过 8px，避免卡片套卡片 |
| 表格数据 | `v-table density="compact"` |

不要在插件里默认使用 `outlined` 输入作为主风格；FlexStudio 插件页和编辑器应优先使用 `solo-filled`。不要把每个字段都包进独立卡片，也不要为了标题、说明文字或空状态额外包多层容器。

## 配置页

配置页用于完成连接、授权、账号/API key 设置、默认行为设置和诊断。

- 顶部可以有紧凑身份行：插件图标、名称、简短副标题、连接状态、刷新/测试等工具按钮。
- 设置流程优先使用操作行：icon、标题、一行说明、状态 chip、右侧动作。
- 诊断信息应可见但次要，例如 backend 状态、依赖插件状态、当前 endpoint、最后同步时间、最近错误。
- 长说明不要直接铺在页面上。把详细步骤放进帮助弹窗、折叠诊断或外部文档链接。
- 明确动作才显示 snackbar，例如保存成功、连接测试失败、授权完成。自动同步不要刷屏。
- 需要 token、API key、refresh token 时，应使用 `hostApi.secrets`，不要写进普通配置 JSON。

## Unit 功能编辑器

功能编辑器嵌在 FlexStudio 的宿主编辑器里，应只展示当前 Unit 类型真正需要的功能设置。

- 不要再添加插件自己的大标题栏、hero、说明卡或重复标题，例如 `Function Settings`、`Unit behavior`。
- 不要展示与当前 Unit 无关的字段。不同 Unit 类型需要不同表单时，按 `typeId` 拆分组件。
- 轻量设置优先自动同步，使用 debounce 调用 `setUnitData`；复杂或危险操作才使用显式保存按钮。
- 不要在普通功能编辑器里放运行预览。运行效果应在 Unit 视图或设备上验证。
- 不要展示 manifest、plugin UUID、内部 schema 等元数据，除非这是明确的诊断模式。

## Unit 外观编辑器

外观编辑器只负责宿主外观数据和用户能理解的外观设置。

- 宿主已经提供 `APPEARANCE` 分类标题时，不要再添加插件自己的外观标题栏。
- 如果插件没有自定义外观能力，只保留 Unit name 等最小必要字段。
- 颜色选择使用 Vuetify `v-color-picker`，通过 swatch + `v-menu` 打开；不要直接使用裸 `<input type="color">`。
- 字体、大小、对齐、间距等控件要和实际渲染语义一致，不要暴露内部像素换算细节。

## 宿主拥有的通用设置与指示灯

- Unit 的通用设置（长按激活、容器保持打开、文件夹点击后返回等）由宿主放在功能编辑区最下方的**同一个分组**里，行样式为“标签 + `?` 帮助 + 靠右 `v-switch`”。插件的功能编辑器只放自己业务的设置，不要重复渲染这些开关，也不要为了对齐而另写一套同样的行。
- 如果插件自己的设置也是开关，沿用同样的行结构：左侧标签、`PreferenceHelpTooltip` 风格的 `?` 帮助、右侧开关，说明文字放在 tooltip 里，不用常驻小字。
- 按钮组每个按钮有宿主绘制的指示灯线（绿色=激活，暗色=关闭），`cycled` 可通过定义里的 `indicator.onFunctionIds` 启用同样的指示灯。不要在外观里自己画指示线、用填充色表达选中，或设置它的颜色。
- 设备排版在 Unit 的 `layouts.default` 和 `layouts.devices[model]` 中声明，由宿主在添加和跨设备 Page 转换时选择，未匹配型号使用 default；详细规则见 [Unit 定义](./unit-definitions.md#layouts：unit-自有设备布局)。插件自行生成子 Unit 时，用 SDK `selectUnitDeviceLayoutV1` 和 `getLayoutContext().deviceModel` 选择同一份声明，不要从网格形状推断型号。Flow2Pro 与 Flexbar 都是单行网格，不要设计需要多行才能放下的默认布局。

## 运行时 Unit 视图

运行时视图在 Flexbar 设备尺寸上显示，优先级是可读性和状态表达。

- 使用 `ResizeObserver` 或 bridge 提供的布局信息适配实际 Unit 宽高。
- 文本必须截断或换行，不能溢出、遮挡图标或覆盖后续内容。
- 小尺寸视图优先 icon 和关键数值；文字标签可隐藏、缩短或截断。
- 避免只为了装饰加入大背景、渐变、无意义图案、营销文案或复杂动画。
- 动态数据更新时避免布局跳动，尤其是歌词、计时器、价格、天气和状态类 Unit。

## 颜色与主题

- 默认使用 FlexStudio 主题 token，例如 `rgb(var(--v-theme-primary))`、`rgb(var(--v-theme-surface))`、`rgba(var(--v-theme-on-surface), 0.72)`。
- 边框、分割线、弱文本和轻微背景应使用 `on-surface` 透明度，不要硬编码灰色。
- FlexStudio `primary` 蓝色是默认插件主题色。
- 插件有明确 app 主题时可以使用 app 色作为 accent，例如 Discord blurple、OBS 深色、YouTube 红、Philips Hue 色彩。但 app 色只用于识别和关键状态，不应支配所有 surface。
- 不要使用大面积单一品牌色背景。插件仍应保留 FlexStudio 的 surface、文本、边框和状态色体系。
- 错误、警告、成功、信息状态优先使用 Vuetify 语义色，不要用品牌色表达错误或风险。

## 信息架构

- 页面应围绕用户任务组织：连接、选择对象、配置动作、查看状态、执行命令。
- 不要用纯描述段落解释“这个插件能做什么”；如果没有立即可操作的信息，删掉或移到 README。
- 空状态应告诉用户下一步动作，例如连接服务、选择设备、创建第一个快捷动作。
- 高级诊断默认收起或放在次要区域，避免压过常用配置。
- 插件 essentials 包不应包含 Flexbar UI 细节；UI/Unit 插件负责 FlexStudio definitions、编辑器、预设和用户体验。

## 响应式与可访问性

- 插件 iframe 宽度可能很窄，所有字段、按钮和 chip 都必须能换行或截断。
- 不要使用 viewport 宽度直接缩放字体。使用固定字号和布局断点。
- icon-only 按钮必须有 tooltip 或 aria label。
- 颜色 swatch、状态 chip 和图标状态需要有文本或辅助说明，不要只靠颜色表达状态。
- 禁用态要绑定真实 readiness、权限、连接状态或表单有效性。

## Agent 检查清单

设计或修改插件 UI 时，agent 在完成前必须自查：

- 是否优先使用 Vuetify 3 组件，并采用 FlexStudio 一致的 `solo-filled`、`tonal`、compact density？
- 是否默认使用 FlexStudio `primary` 蓝色，只有明确 app 主题时才使用 app accent？
- 是否删掉了没有操作价值的描述性内容、营销式 hero 和装饰性容器？
- 是否避免卡片套卡片、多层 panel、重复标题和宿主已有标题的二次包装？
- 是否所有用户可见文案都走本地化资源？
- 是否所有小尺寸 Unit 视图都能处理文字溢出和动态数据更新？
- 如果设计需要插件系统新增能力、跨平台能力不一致或无法用当前 SDK 表达，是否已经停下来报告？
# 实时状态 UI

持续的同插件 UI 状态使用 Renderer State Channel retained replay，不用 interval 或 long-polling。`unavailable`、等待 replay snapshot、`resyncRequired` 应显示稳定的不可用/同步中状态，避免闪烁、阻塞交互或展示跨 epoch 的陈旧值。Vue 组件在 mount 订阅并在 unmount 主动 unsubscribe；Host 的 session cleanup 只是安全网。

## Function 容器和选项数量

宿主 AppearancePopover 统一决定可用宽度、边距和滚动区域。中间标签页、Function 容器、路由器和 iframe 使用 width:100%、min-width:0，不得各自追加 max-content 或最小内容宽度。插件只在实际 iframe 宽度内响应式排布；关联的次要字段可同一行，窄屏自然换行。不要使用固定右侧补偿量。

离散选项统一使用 FlexChoice：1 项只读值，2 项 grouped button，3 项及以上宿主菜单。跨 iframe 的弹层由宿主拥有；表单使用 openFormDialog。不要依赖 iframe 内菜单溢出。

## Composite 与按钮组编辑

Composite 复用宿主画布、平铺图层和属性面板。右侧 Button 区块集中展示布局、受限字体／字号、模式／状态和该 Button 的业务配置；不要另开按钮编辑弹窗或用多个 Unit 模拟一张组合面板。基础外观只保留背景，元素字段在高级编辑器中修改。

Button 支持 title-only/icon-only/icon-left/icon-top/none；none 用于透明独立热区。按钮组只提供前四种，整组共享原生外观，每按钮只编辑名称、MDI 图标与业务数据。它们的确认状态由平台指示灯表达，不另画选中线。Composite 只提供 Unit 级 tap；key Button 自己可配置长按与连发。

字体和档位来自公共准入契约。布局退化提示采用 compact 警示，明确被隐藏／裁切的内容，并提供重算档位动作；动作是一笔草稿修改。切换局部状态预览不执行插件业务、不写 Project 历史。普通 Theme 与样式复制／粘贴不改变 Composite 或按钮组。
