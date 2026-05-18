# 插件开发

FlexStudio 插件用于把新的设备能力、Unit 类型、编辑器页面、Canvas 渲染逻辑和宿主能力集成到 FlexStudio。插件由 `manifest.json` 描述，由 SDK 提供运行时类型和桥接能力，由 CLI 完成创建、构建、打包、调试和本地安装，由 FlexStudio 主进程负责生命周期、权限校验、后端进程管理、资源协议、iframe 桥接和市场安装。

本章节面向插件作者，目标是让开发者可以快速开始开发插件，并在需要时查到完整 API 与发布流程。

## 建议阅读顺序

1. 阅读 [插件系统概览](./overview.md)，先理解插件在 FlexStudio 中的运行模型。
2. 按 [快速开始](./getting-started.md) 创建插件，并用 `plugin-v2 dev` 在 FlexStudio 中调试。
3. 根据插件需要完善 [Manifest 配置](./manifest.md) 和 [Unit 定义](./unit-definitions.md)。
4. 使用 [后端运行时](./backend-runtime.md)、[插件依赖 API](./dependency-api.md)、[前端桥接](./frontend-bridge.md) 和 [Host API Reference](./host-api-reference.md) 开发功能。
5. 发布前使用 [CLI Reference](./cli-reference.md) 验证、构建、打包插件。
6. 按 [发布到插件市场](./marketplace-release.md) 配置 GitHub Release 自动发布。

## 插件能做什么

插件可以：

- 注册新的插件 Library 与 Unit 类型。
- 为 Unit 提供功能编辑器、外观编辑器、运行视图或 Canvas 推帧能力。
- 在独立后端进程中执行 Node.js 逻辑。
- 向直接依赖插件暴露后端 API，或调用直接依赖插件暴露的后端 API。
- 通过受权限控制的 Host API 访问文件、HTTP、系统信息、持久化配置、事件总线、设备能力、Canvas 输出和部分 Electron 能力。
- 在前端 iframe 中渲染 Vue 页面，并通过桥接 API 与 FlexStudio 通信。
- 通过 GitHub Release 发布 `.flexplugin` 包到插件市场。
