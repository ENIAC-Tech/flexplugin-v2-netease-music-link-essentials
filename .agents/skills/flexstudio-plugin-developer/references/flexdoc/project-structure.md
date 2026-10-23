# 项目结构

v2 插件是一个独立的 Node.js 项目。CLI 模板会生成约定目录，FlexStudio 运行时只依赖构建后的 manifest、后端入口、前端页面、资源和本地化文件。

## 推荐目录

```text
my-plugin/
+-- .agents/
|   `-- skills/
|       `-- flexstudio-plugin-developer/
|           +-- SKILL.md
|           `-- references/
|               `-- flexdoc/
+-- .flexstudio/
|   `-- plugin-docs.json
├─ manifest.json
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ src/
│  ├─ backend/
│  │  └─ index.ts
│  └─ frontend/
│     ├─ unit-function-editor.ts
│     ├─ unit-appearance-editor.ts
│     ├─ unit-view.ts
│     ├─ config-page.ts
│     └─ components/
├─ locales/
│  ├─ en.json
│  └─ zh.json
├─ assets/
│  └─ icon.png
├─ .marketplace/
│  ├─ README.en.md
│  └─ README.zh.md
└─ .github/
   └─ workflows/
      └─ publish.yml
```

构建后通常生成：

```text
dist/
├─ manifest.json
├─ backend/
│  └─ index.js
├─ frontend/
│  ├─ unit-function-editor.html
│  ├─ unit-appearance-editor.html
│  ├─ unit-view.html
│  └─ config-page.html
├─ locales/
└─ assets/
```

打包后通常生成：

```text
release/
└─ my-plugin-universal.flexplugin
```

native 插件会按平台生成包，例如：

```text
release/
├─ my-plugin-win32-x64.flexplugin
├─ my-plugin-darwin-arm64.flexplugin
├─ my-plugin-darwin-x64.flexplugin
└─ my-plugin-linux-x64.flexplugin
```

## manifest.json

`manifest.json` 是插件包的入口索引。FlexStudio 会从这里读取插件身份、平台、权限、入口文件和依赖。

manifest 应该提交到仓库根目录，并在构建时复制到 `dist/manifest.json`。manifest 中的 `entry` 路径应指向构建产物，而不是源码文件。

## src/backend

后端入口运行在插件独立进程中，适合放置：

- 插件生命周期逻辑。
- Unit 与 Library 定义注册。
- Host API 调用。
- 文件、HTTP、系统信息、设备能力等需要后端执行的逻辑。
- Renderer RPC handler。
- Canvas Unit 的帧推送逻辑。

后端入口通常导出一个继承 `FlexPluginBase` 的默认类。

## src/frontend

前端入口运行在 FlexStudio 创建的 iframe 中。每个入口可以是一个单独页面，例如：

- `unitFunctionEditor`：编辑 Unit 功能数据。
- `unitAppearanceEditor`：编辑 Unit 外观数据。
- `unitView`：自定义 Unit 的运行视图。
- `configPage`：插件配置页面。

前端页面通过 SDK 的桥接 API 与 FlexStudio 通信，不应直接访问 FlexStudio 内部模块。

## locales

`locales/` 存放插件本地化资源。manifest 中可以通过 `defaultLocale` 和 `supportedLocales` 声明默认语言和支持语言。

建议至少提供默认语言文件，并让插件 UI 中所有用户可见文本都走 SDK i18n 或高级自定义 i18n 层。`@flexsdk/runtime` 提供框架无关的 `createPluginI18n()` / `translate()`，Vue 前端页面可以从 `@flexsdk/runtime/vue` 使用 `usePluginI18n()`。

当前 SDK i18n 推荐由插件显式导入或传入 messages：

```ts
import en from '../../locales/en.json'
import zhCN from '../../locales/zh-CN.json'
import { createPluginI18n } from '@flexsdk/runtime'

const i18n = createPluginI18n({
  defaultLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
    zh: zhCN,
  },
})

i18n.t('config.saved', { name: 'Flexbar' })
```

语言匹配顺序为：精确 locale（如 `zh-CN`）→ 基础语言（如 `zh`）→ `defaultLocale`。缺失 key 会返回 key 本身。插值支持 `{{name}}` 和 `{name}` 两种占位符。CLI 会继续把 `locales/` 复制到 `dist/locales/`；SDK 不会默认自动 fetch 这些文件，避免插件 iframe asset 路径、dev/prod base path 和 CSP 约定不一致。

## assets

`assets/` 存放插件图标、图片、字体或前端页面需要加载的静态资源。构建时 CLI 会把资源复制到 dist，运行时 FlexStudio 通过 `plugin-asset://` 协议提供访问。

## .marketplace

`.marketplace/README.{lang}.md` 用于插件市场详情页。市场优先读取对应语言 README，找不到时回退到仓库根目录 `README.md`。

建议包含：

- 插件用途和主要功能。
- 支持设备与平台。
- 权限说明。
- 使用方式。
- 版本兼容说明。
- 常见问题。

## .github/workflows

发布到插件市场必须通过 GitHub Release。官方 reusable workflow 会在 Release 发布时构建插件、打包 `.flexplugin`、上传 Release Asset，并通知插件市场。

workflow 必须固定到官方 workflow 的版本 tag，不能使用 `@main`。

## 构建产物约定

`plugin-v2 build` 会完成：

- 校验 manifest。
- 清理输出目录。
- 使用 esbuild 构建后端入口。
- 如果存在 Vite 配置，则构建前端页面。
- 复制 manifest、locales、assets 等运行时文件。

`plugin-v2 pack` 会把 dist 目录打包为 `.flexplugin`。非 native 插件默认生成 universal 包；native 插件必须指定平台。
# Renderer State Channel 的代码位置

同插件 UI retained state 的 channel 常量与 JSON payload type 建议放在 `src/shared/`，供 `src/backend/index.ts` 的 `registerRendererStateChannel()` / `publishRendererState()` 和 `src/frontend/*.vue` 的 `subscribeRendererState()` 共用。组件负责 mount/unmount 订阅清理；不要新增 polling worker、长 RPC 或全局 bus 文件。
