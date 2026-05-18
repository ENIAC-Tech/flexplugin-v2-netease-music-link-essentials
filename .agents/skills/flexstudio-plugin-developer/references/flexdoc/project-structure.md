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

建议至少提供默认语言文件，并让插件 UI 中所有用户可见文本都走本地化资源或插件自己的 i18n 层。

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
