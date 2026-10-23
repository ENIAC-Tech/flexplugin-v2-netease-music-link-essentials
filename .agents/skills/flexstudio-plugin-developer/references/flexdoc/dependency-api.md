# 插件依赖 API

插件依赖 API 用于让一个插件后端显式暴露可被直接依赖插件调用的方法。典型场景是把底层能力封装成基础插件，再由上层插件复用，例如：

## Dependency State Channel

> 选择边界：Dependency State Channel 面向声明过的直接依赖；Renderer State Channel 面向 Provider 自己的 renderer session。二者都有 retained snapshot/delta 语义，但授权和 wire identity 不同。

当依赖插件需要持续发布“最新状态”而不是单次请求/响应时，使用由宿主治理的 State Channel。它不是全局事件总线：Consumer 必须在 manifest 中声明 Provider 为直接依赖，并声明现有的 `pluginApi` 权限；Provider 的注册和发布也必须声明 `pluginApi`，无需新增 manifest 字段。

Provider 在 `onLoad()` 中注册稳定、全小写的 channel 名称，再发布完整 snapshot 或 RFC 7396 Merge Patch delta：

```ts
await this.registerDependencyStateChannel('playback')
await this.publishDependencyState('playback', {
  kind: 'snapshot',
  payload: { playing: true, position: 0 },
})
```

Consumer 使用 `onDependencyState()` 订阅，并保存返回的 unsubscribe 函数；`replayLatest: true` 先收到 `available`，随后收到当前完整 snapshot（如果 Provider 已发布状态）。

```ts
const unsubscribe = await this.onDependencyState('@acme/provider', 'playback', async (event) => {
  if (event.kind === 'unavailable') return
  if (event.resyncRequired) {
    // Discard local cache and replace it with event.payload.
  }
  // Replace local state with snapshot payload using epoch/revision ordering.
  // Provider delta input is materialized by Host; subscriber payload is not a patch.
}, { replayLatest: true })
```

回调只存在于 Consumer 自己的后端进程；不会跨 IPC 传递函数。SDK 在 handler 完成（即使抛错）后 ACK，宿主才会投递下一项。Provider 重启时 epoch 增加；Consumer 收到更高 epoch 时必须丢弃旧状态。Provider 输入可以是 snapshot 或 Merge Patch delta，Host 合并后统一向订阅者发送完整 `kind: 'snapshot'`。消费端替换状态，不再次合并。`available` 使用 revision 0；`unavailable` 会递增 revision，生命周期事件应在数据去重前处理。单次输入及合并后的 retained state 都必须是根对象的 JSON，最大 64 KiB；高频合并或队列溢出时，宿主发送带 `resyncRequired: true` 的完整 snapshot。不要用 `bus.emit()` 或 topic 前缀替代该能力。

```text
plugin-a -> plugin-b -> plugin-c
```

其中 `plugin-c` 暴露 API 给 `plugin-b`，`plugin-b` 调用 `plugin-c` 后再暴露 API 给 `plugin-a`。调用发生在插件后端进程之间，FlexStudio 主进程负责权限校验、依赖关系校验、进程路由和超时处理。

## 适用场景

适合使用插件依赖 API 的场景：

- 一个插件提供可复用的设备、协议、数据处理或服务封装。
- 上层插件需要同步请求/响应式调用依赖插件的后端能力。
- 调用关系应当受 manifest 依赖声明和 Host API 权限控制。

不适合的场景：

- 同一插件前端调用自己的后端：使用 `backendRpc()` 和 `registerRendererRpc()`。

## 状态与调用机制对照

| 机制 | 生产者 → 消费者 | 生命周期 | 授权 | 适用场景 |
|---|---|---|---|---|
| Dependency State Channel | Provider 后端 → 直接依赖后端 | retained replay、epoch/revision、ACK | Consumer 的 `pluginApi` + manifest 直接依赖 | 持续依赖状态 |
| Renderer State Channel | 插件后端 → 同插件 iframe | retained replay、epoch/revision、ACK | Provider 当前 `pluginApi` permission rule；Host 绑定 session | 持续同插件 UI 状态 |
| dependency API | Consumer 后端 → Provider 后端 | 一次请求/响应 | `pluginApi` + 直接依赖 | 一次性跨插件命令/查询 |
| backend RPC | 同插件 iframe → 后端 | 一次请求/响应 | Host 隔离的同插件 session | 一次性 UI 命令/查询 |
| global bus | Host topic 广播 | 非 retained | topic/capability 规则 | Host 事件；不得代替 retained state |

不要用 interval、long-polling、重复 RPC read 或 global bus 模拟 retained state。
- 松散广播或订阅事件：使用事件总线。
- 调用 FlexStudio 宿主能力：直接使用对应 Host API。

## Manifest 配置

调用方必须同时声明直接依赖和 `pluginApi` 权限。

```json
{
  "uuid": "@acme/plugin-b",
  "permissions": ["logger", "pluginApi"],
  "dependencies": [
    {
      "uuid": "@acme/plugin-c",
      "minVersion": "1.0.0"
    }
  ],
  "entry": {
    "backend": "dist/backend/index.js"
  }
}
```

只暴露 API 但不调用其他插件的插件，不需要声明 `pluginApi`。如果一个插件既暴露 API 又调用它自己的依赖，则它作为调用方也需要 `pluginApi`。

依赖 API 只允许调用 manifest 中声明的直接依赖。`plugin-a` 依赖 `plugin-b`，`plugin-b` 依赖 `plugin-c` 时，`plugin-a` 不能越过 `plugin-b` 直接调用 `plugin-c`，除非 `plugin-a` 自己也在 manifest 中声明了 `plugin-c`。

## 暴露依赖 API

在后端入口类中调用 `registerDependencyApi(method, handler)` 暴露方法。handler 的参数来自调用方传入的 `params` 数组，返回值必须可序列化。

```ts
import { FlexPluginBase } from '@flexsdk/runtime'
import type { PluginDefinitionsPayload, PluginLoadContext } from '@flexsdk/types'

export default class ProviderPlugin extends FlexPluginBase {
  async onLoad(ctx: PluginLoadContext): Promise<void> {
    await super.onLoad(ctx)

    this.registerDependencyApi('getStatus', async (scope: string) => {
      return {
        scope,
        healthy: true,
        provider: this.pluginUUID,
      }
    })
  }

  async onUnload(): Promise<void> {
    this.unregisterDependencyApi('getStatus')
  }

  async getDefinitions(): Promise<PluginDefinitionsPayload> {
    return { libraries: [], units: [] }
  }
}
```

方法名是插件之间的公开契约，建议使用稳定、语义明确的名称，并在插件版本变更时保持向后兼容。需要破坏性变更时，优先新增方法名，例如 `getStatusV2`。

## 调用直接依赖

调用方通过 `this.hostApi.plugin.callDependency()` 调用直接依赖插件暴露的方法。

```ts
type ProviderStatus = {
  scope: string
  healthy: boolean
  provider: string
}

const status = await this.hostApi.plugin.callDependency<ProviderStatus>(
  '@acme/plugin-c',
  'getStatus',
  ['device'],
)
```

参数说明：

| 参数 | 说明 |
| --- | --- |
| `dependencyUUID` | 目标依赖插件 UUID，必须是当前插件 manifest 中声明的直接依赖。 |
| `method` | 目标插件通过 `registerDependencyApi()` 注册的方法名。 |
| `params` | 传给目标 handler 的参数数组。省略时等同于空数组。 |

## 链式依赖示例

`plugin-c` 暴露底层能力：

```ts
this.registerDependencyApi('readValue', async () => {
  return { plugin: 'c', value: 42 }
})
```

`plugin-b` 调用 `plugin-c`，再向上暴露自己的 API：

```ts
this.registerDependencyApi('readComposedValue', async () => {
  const cResult = await this.hostApi.plugin.callDependency(
    '@acme/plugin-c',
    'readValue',
  )

  return {
    plugin: 'b',
    dependency: cResult,
  }
})
```

`plugin-a` 调用 `plugin-b`：

```ts
const result = await this.hostApi.plugin.callDependency(
  '@acme/plugin-b',
  'readComposedValue',
)
```

## 运行时约束

- 只能调用已声明的直接依赖。
- 目标依赖插件必须已安装并处于启用状态。
- 调用方必须声明 `pluginApi` 权限。
- 目标方法必须通过 `registerDependencyApi()` 显式注册。
- 调用发生在后端进程之间；前端页面需要先通过 `backendRpc()` 调用自己的后端，再由后端调用依赖插件。
- 参数和返回值必须可序列化，不支持函数、类实例引用、循环引用或进程内对象句柄。
- 宿主会等待依赖插件响应；目标插件退出、崩溃、降级或超时都会使调用失败。

## 缺失依赖的默认终止策略

使用 FlexSDK2 的 `FlexPluginBase` 时，SDK 会检测
`this.hostApi.plugin.callDependency()` 的依赖可用性错误。目标依赖未安装、未启用、未加载、
未找到，或没有声明为直接依赖时，SDK 默认会向宿主上报 `reason: "missingDependency"` 的
`plugin-fatal`，然后终止当前插件后端进程。FlexStudio 会把调用方插件标记为降级，而不是反复重启。

只有在插件明确能在缺少该依赖时继续降级运行时，才应显式禁用这个策略：

```ts
export default class ConsumerPlugin extends FlexPluginBase {
  constructor() {
    super()
    this.setMissingDependencyAutoTerminate(false)
  }
}
```

禁用自动终止后，`callDependency()` 会按原样抛出宿主错误，插件需要自行捕获并实现 fallback。

## 常见错误

| 错误 | 含义 | 处理方式 |
| --- | --- | --- |
| `Permission denied: pluginApi` | 调用方没有声明 `pluginApi` 权限。 | 在调用方 manifest 的 `permissions` 中加入 `pluginApi`。 |
| `cannot call ... because it is not a declared direct dependency` | 目标不是调用方声明的直接依赖。 | 在调用方 manifest 中添加目标依赖，或改为通过中间依赖转发。 |
| `Dependency plugin ... is not enabled` | 目标依赖未启用。 | 安装并启用目标插件。 |
| `Dependency API '<method>' is not registered` | 目标插件没有注册该方法。 | 检查方法名和目标插件后端启动逻辑。 |
| `Dependency API timeout` | 目标插件没有在超时时间内返回。 | 检查目标插件日志，避免 handler 中长时间阻塞。 |

## API 设计建议

- 把依赖 API 当作跨插件公共接口，不要暴露内部对象或临时实现细节。
- 为入参与返回值定义 TypeScript 类型，并在运行时校验外部输入。
- 返回结构中包含足够的错误上下文，但不要泄露密钥、token 或本地路径。
- 尽量让方法保持幂等；对有副作用的方法使用清晰动词，例如 `createProfile`、`writeFrame`。
- 在 marketplace 描述或插件 README 中说明依赖关系、权限用途和兼容版本。
