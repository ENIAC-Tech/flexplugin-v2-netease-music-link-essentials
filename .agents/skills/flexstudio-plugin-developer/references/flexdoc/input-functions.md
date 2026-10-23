# 输入功能

输入功能让用户把物理按键、编码器或绝对值控件绑定到插件行为。功能和 Unit 分开注册：功能可以不占用屏幕，也可以要求同页某种 Unit 作为目标。不要为了接收编码器事件创建隐藏 Unit，也不要订阅原始设备 BUS 绕过绑定路由。

本页对应当前 `defineFunction`、`FlexPluginBase.functions` 和 `input-function-settings` 契约。开发板支持 Flow2Pro、FlexbarV2；功能能否出现在某个控件的选择列表中，由该控件的实际通道及功能要求共同决定，不以型号名称猜测能力。预留编码器可配置，但没有物理驱动。

## 注册和通道

在 manifest 的 `permissions` 声明 `input`；使用触觉时还需 `device`。`input` 是基础权限。功能定义不放入 `getDefinitions().units`，也不新增 manifest 入口字段：

```ts
import { defineFunction, FlexPluginBase } from '@flexsdk/runtime';
import { input } from '@flexsdk/runtime/input';

export default class TimelinePlugin extends FlexPluginBase {
  async getDefinitions() { return { libraries: [], units: [] }; }

  functions = {
    timeline: defineFunction({
      name: { default: 'Timeline', translations: { 'zh-CN': '时间轴' } },
      icon: 'mdi-timeline',
      inputs: { rotate: 'required', press: 'optional' },
      settings: {
        step: { type: 'number', label: 'Step', default: 1, min: 1, max: 10, step: 1 },
        enabled: { type: 'switch', label: 'Enabled', default: true }
      },
      onInput: input.gestures<{ step: number; enabled: boolean }>({
        rotate(event, ctx) {
          if (!ctx.settings.enabled) return;
          const delta = event.delta * ctx.settings.step;
          // Apply delta to the application's timeline, then report confirmed state.
          ctx.feedback({ text: String(delta) });
        },
        click(_event, ctx) { ctx.feedback({ text: 'Selected' }); }
      })
    })
  };
}
```

字典键 `timeline` 是稳定的 `functionId`。基类 `getFunctionDefinitions()` 收集可序列化定义；不要自行实现另一套定义收集或事件分发。若覆盖 `onLoad` / `onUnload`，保留基类生命周期调用。

`inputs` 的键为 `rotate`、`press`、`value`，值为 `required` 或 `optional`；至少声明一个通道。必须通道缺失时功能不可选。`press` 对应按键或编码器下压。编码器设置为“按住切层”后，下压由设备路由占用，不能用于要求 `press` 的功能；可选 `press` 的旋转功能仍可使用。

可选 `target` 是插件 Unit 的 **unitId**（如 `console`），不是完整 typeId、实例 UUID、型号或 Library ID。声明后用户需选择同页匹配 Unit，运行时通过 `ctx.target.uuid` 访问。省略时功能无需目标 Unit。缺失插件、失效目标和未知控件保留配置并显示不可用，不隐式改成其他功能。

`name`、`description`、字段标签和可用性原因支持 `PluginDisplayText`（字符串或 `{ default, translations }`）。可用 `createPluginI18n(...).displayText(key)` 生成全部语言的显示文本，图标使用 `mdi-*` 名称。

## 输入与生命周期

| 输入 | 字段 | 含义 |
| --- | --- | --- |
| `press` | `down`, `t` | 按下/松开与设备时间戳（毫秒）。 |
| `rotate` | `delta`, `pressed`, `t` | 有符号增量、是否按住旋转。 |
| `value` | `value`, `range: { min, max, step }`, `sync`, `t` | 绝对值；`sync` 表示同步快照，不一定是用户操作。 |
| `cancel` | `t` | 当前操作失效，清理按住状态、定时器和待发反馈。 |

`onActivate(ctx)` 初始化当前有效绑定，`onInput(event, ctx)` 处理输入，`onDeactivate(ctx)` 清理外部资源。上下文包含只读 `device`（序列号/型号）、`bindingId`、`control`、`settings` 和可选 `target`。

SDK 按“设备序列号＋绑定 ID”串行等待回调完成，并管理绑定代次。不同设备可能部署同一项目、拥有相同绑定 ID，插件自己的缓存也必须采用两者作为键。不要用全局变量保存所有绑定的游标、按住状态或待处理请求。

切页、切模式、切层、重载等会使原操作失效；取消后不要把旧按下对应的松开交给新目标。离线输入丢弃，重连先重新激活，不能补发离线期间的操作。SDK 会阻止失效上下文的反馈，但无法撤回已经启动的远程业务请求；对需要中止的请求用本绑定的取消信号并在清理时终止。

## 工具、反馈与可用状态

从 `@flexsdk/runtime/input` 导入 `input` 或各工具：

| 工具 | 用途 |
| --- | --- |
| `gestures(callbacks, options?)` | 点击、双击、长按、普通/按住旋转。默认长按 800ms、双击间隔 300ms；按住旋转抑制点击。没有加速或长按重复。 |
| `quantize(handler, { stepsPerUnit })` | 累积旋转余量，每达到一个单位执行一次。 |
| `absolute(handler, { min, max, initial })` | 旋转转绝对值并限幅；用返回函数的 `setValue(ctx, value)` 对齐已确认值。 |
| `throttleFeedback(ctx, intervalMs?)` | 返回反馈函数，立即发送第一条，再按默认 66ms 发送最新值。取消清空待发值。 |
| `ignoreSync(handler)` | 忽略 `sync: true` 的绝对值事件，仍处理取消。 |
| `haptics.boundary(ctx)` / `haptics.confirm(ctx)` | 请求边界/确认触觉，分别使用 `bump` / `click`。 |

工具随绑定生命周期清理；在功能定义时创建处理器，不要每个事件重新创建，否则无法累计手势和余量。

`ctx.feedback({ text?, icon?, value? })` 显示当前功能反馈；底层 `hostApi.input.feedback(serialNumber, bindingId, generation, content)` 需要当前代次，普通插件优先使用上下文。不能给其他插件的绑定写反馈。`value` 是归一化到 `[0, 1]` 的实际绝对位置；相对或未知状态省略它。超出范围或非有限数值会被宿主拒绝（`Invalid input feedback`），例如 `absolute({ min: 0, max: 100 })` 应发送 `value / 100`。

`this.functions.timeline.setAvailable(false, 'Connect the application')` 设置该功能的可用状态；第三个参数 `{ serialNumber }` 可只更新一台设备。恢复时调用 `setAvailable(true, undefined, { serialNumber })`。底层为 `hostApi.input.setAvailability(functionId, available, reason?, serialNumber?)`；SDK 辅助方法也支持在加载前设置初始状态。

`ctx.haptic(effect, { strength?, count? })` 或 `hostApi.device.haptic(serialNumber, effect, options?)` 由宿主按设备描述校验效果和参数。无马达设备不执行触觉，不以日志或模拟反馈声称已经振动。`keyMode` 允许插件读取，不允许插件写入。

触觉强度省略时为 100，设为 0 时无输出；次数省略时为 1，支持 1–16 的整数。设备关闭振动时不执行插件触觉。队列满或会话失效的请求会丢弃，不会在重连后补播。

## 设置与设置页

简单设置用 `settings` 声明：`text`、`textarea`、`select` 的值为字符串，`number` 为数字，`switch` 为布尔值。字段用 `default`，不是表单实例的 `value`；选项为 `{ value, title }`。宿主提供编辑器并按类型校验，插件从 `ctx.settings` 读取。

复杂设置可声明 `settingsPage: 'src/frontend/input-settings.html'`，路径与 manifest 入口一样，相对插件安装后的 `entry/`（开发构建的 `dist/`）。文件必须由构建产出并装入包；不要假定宿主自动加上前端目录。沿用既有 `mountFlexPage` / `useFlexBridge`：

```ts
mountFlexPage({
  components: {
    inputFunctionSettings: InputSettings,
    // Optional per-function override:
    inputFunctionSettingsByFunctionId: { timeline: TimelineSettings }
  }
});
```

该页的 `pageKind` 是 `input-function-settings`，没有必需的 Unit。桥接提供：

```ts
const context = await bridge.getInputBindingContext();
// context: { sessionId, functionId, settings, scope, layer, control } | null
if (context) {
  const sessionId = context.sessionId; // Capture before awaiting or editing.
  await bridge.setInputBindingSettings(sessionId, nextSettings);
}
```

`nextSettings` 是 JSON 对象，允许嵌套数组/对象。保存只修改当前绑定，经过项目命令，支持默认/页面覆盖、撤销/重做。宿主切换控件、范围、层或功能后，旧会话保存会被拒绝；不要用新 `sessionId` 重试旧草稿。读取失败时不要用空对象覆盖现有设置。通过 `input-binding-updated` 宿主事件刷新状态，并在卸载时取消订阅；`useFlexBridge` 重新就绪后重新读取。

设置页沿用 [插件 UI 规范](./ui-ux-guidelines.md)，显示有意义的字段和状态。FullTest 的 JSON 文本框只验证复杂对象传输，不是正式插件设置界面的模板。

## 验证和交付

用当前配套 SDK、CLI 和宿主执行 manifest/功能定义校验、实际构建和打包。至少验证：必需通道筛选、无目标/有目标功能、按下与松开顺序、取消、两台设备同绑定 ID 隔离、离线不补发、重连激活、过期反馈丢弃。设置页验证范围/层切换、撤销/重做和迟到保存拒绝。

模板提供最小旋转功能；FlexPluginFullTest 的输入时间轴是协议与设置页测试夹具。软件测试和真实硬件验证分别记录；声明支持的控件没有驱动时，不能把注入事件测试当作实机验收。

## 带目标 Agent Panel 的输入

功能声明 `target:'console'` 并通过 `ctx.target.uuid` 定位实例。使用 `hostApi.unit.sendPanelInput(sn, uuid, input)` 转发相对输入：rotate/delta、press/down、cancel。取消或停用绑定时发送 cancel；不要合并丢失 press 边沿。

触摸和旋钮共用设备侧导航所有者。插件不再维护面板游标，也不能通过 `setPanelModel.navigation` 选择页面或动作；旧导航字段被 Host 拒绝。选中和 browse 事件只是平台已发生状态的通知，可用于提供对应数据窗口。

只有原生 Panel 发出的 action 事件触发审批/回复等业务执行。收到事件后插件重新验证请求身份、有效期和权限，使用 `ackPanelAction` 返回结果。面板的长按、按压取消和焦点变更由原生 UI 处理。无目标的“打开当前桌面会话”等功能仍可执行其自身声明的业务动作。完整接口见 [Agent Panel](./unit-definitions.md#panel-平台原生-agent-panel)。
