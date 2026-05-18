# CLI Reference

FlexCLI 包名为 `@eniac/flexcli`。v2 插件开发使用 `plugin-v2` 命令组与 FlexStudio 的插件控制 WebSocket 通信。创建插件项目仍通过 `plugin create`，创建时选择 v2 模板。

## 安装

```bash
npm install -g @eniac/flexcli
```

检查版本和帮助：

```bash
flexcli --help
flexcli plugin-v2 --help
```

## v1 与 v2

| 命令组 | 宿主 | 用途 |
| --- | --- | --- |
| `plugin` | FlexDesigner | 旧版插件命令，也包含 `create` 交互式创建入口。 |
| `plugin-v2` | FlexStudio | FlexStudio v2 插件管理、构建、打包、验证和调试。 |

开发 FlexStudio 插件时，日常命令应使用 `plugin-v2`。

## 连接参数

需要连接 FlexStudio 的命令通常支持：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--host <host>` | `127.0.0.1` | FlexStudio 插件控制 WebSocket host。 |
| `--port <port>` | `34579` | FlexStudio 插件控制 WebSocket port。 |
| `--token <token>` | 无 | 鉴权 token。也可以使用环境变量。 |

Token 环境变量：

```bash
FLEX_WS_TOKEN=<token>
PLUGIN_WS_TOKEN=<token>
```

`FLEX_WS_TOKEN` 和 `PLUGIN_WS_TOKEN` 都可用。

## 创建插件

```bash
flexcli plugin create
```

交互式创建时选择 v2 模板：

```text
v2 (recommended: TypeScript + FlexSDK2, does not support flexbar v1)
```

模板会生成：

- TypeScript 后端。
- Vue 3 前端。
- `manifest.json`。
- 构建、开发、打包 npm scripts。
- GitHub Release 发布 workflow。
- 市场 README 模板。

创建后：

```bash
cd my-plugin
npm install
npm run build
```

## plugin-v2 list

列出 FlexStudio 中已安装的 v2 插件。

```bash
flexcli plugin-v2 list
```

参数：

```text
--host <host>
--port <port>
--token <token>
```

输出为 JSON，包含插件状态和元数据。

## plugin-v2 install

从目录或 `.flexplugin` 包安装插件。

```bash
flexcli plugin-v2 install <source>
```

示例：

```bash
flexcli plugin-v2 install ./release/demo-plugin-universal.flexplugin
flexcli plugin-v2 install ./dist
```

参数：

```text
--host <host>
--port <port>
--token <token>
```

## plugin-v2 uninstall

卸载插件。

```bash
flexcli plugin-v2 uninstall <uuid>
```

示例：

```bash
flexcli plugin-v2 uninstall @acme/demo-plugin
```

## plugin-v2 enable

启用插件。

```bash
flexcli plugin-v2 enable <uuid>
```

## plugin-v2 disable

禁用插件。

```bash
flexcli plugin-v2 disable <uuid>
```

## plugin-v2 reload

热重载插件。

```bash
flexcli plugin-v2 reload <uuid>
```

常用于修改后端或前端构建产物后，让 FlexStudio 重新加载插件。

## plugin-v2 logs

实时查看插件日志。

```bash
flexcli plugin-v2 logs <uuid>
```

命令会先打印日志 ring buffer 中的最近记录，然后持续输出实时日志。按 `Ctrl+C` 停止。

## plugin-v2 dev

构建并挂载插件目录用于开发，支持 watch 和自动重载。

```bash
flexcli plugin-v2 dev <plugin-dir>
```

示例：

```bash
flexcli plugin-v2 dev .
flexcli plugin-v2 dev . --host 127.0.0.1 --port 34579
```

`dev` 会执行：

1. 构建插件。
2. 通过控制 WebSocket 挂载插件目录。
3. 订阅插件日志。
4. 监听 `manifest.json`、`src/backend`、`src/frontend`、`locales`、`assets`。
5. 文件变化时重新构建并触发插件重载。

参数：

```text
--host <host>
--port <port>
--token <token>
```

## plugin-v2 validate

校验 manifest 和可选 definitions JSON。

```bash
flexcli plugin-v2 validate
```

参数：

| 参数 | 说明 |
| --- | --- |
| `--plugin-dir <dir>` | 插件根目录，默认当前目录。 |
| `--definitions <file>` | definitions JSON 文件路径，用于校验 Library 和 Unit payload。 |
| `--skip-manifest` | 只校验 `--definitions`，跳过 manifest。 |

示例：

```bash
flexcli plugin-v2 validate --plugin-dir .
flexcli plugin-v2 validate --definitions ./dist/definitions.json --skip-manifest
```

校验内容包括：

- `manifest.json` 结构。
- `schemaVersion`、UUID、entry、权限、平台等字段。
- definitions schema。
- `standard`、`custom`、`canvas` Unit 规则。
- `libraryUUID`、`unitId`、`typeId` 一致性。

## plugin-v2 build

构建 v2 插件。

```bash
flexcli plugin-v2 build
```

参数：

| 参数 | 说明 |
| --- | --- |
| `--plugin-dir <dir>` | 插件根目录，默认当前目录。 |
| `--out-dir <dir>` | 输出目录，默认 `<plugin-dir>/dist`。 |
| `--minify` | 压缩后端 bundle。 |

示例：

```bash
flexcli plugin-v2 build --plugin-dir . --out-dir dist
flexcli plugin-v2 build --minify
```

构建过程：

- 校验 manifest。
- 清理输出目录。
- 使用 esbuild 编译后端。
- 如果存在 Vite 配置，则构建前端页面。
- 复制 manifest、locales、assets 等运行时文件。

## plugin-v2 pack

把构建后的插件目录打包为 `.flexplugin`。

```bash
flexcli plugin-v2 pack
```

参数：

| 参数 | 说明 |
| --- | --- |
| `--dist-dir <dir>` | 已构建插件目录，默认 `cwd/dist`。 |
| `--output <path>` | 输出 `.flexplugin` 路径。设置后覆盖默认命名。 |
| `--platform <platform>` | 目标平台：`win32-x64`、`darwin-arm64`、`darwin-x64`、`linux-x64`。非 native 插件默认 `universal`。 |

示例：

```bash
flexcli plugin-v2 pack --dist-dir dist
flexcli plugin-v2 pack --dist-dir dist --output release/demo.flexplugin
flexcli plugin-v2 pack --dist-dir dist --platform win32-x64
```

非 native 插件默认生成 universal 包。native 插件必须指定 `--platform`。

## plugin-v2 diagnostics

获取 FlexStudio v2 插件系统诊断信息。

```bash
flexcli plugin-v2 diagnostics
```

参数：

```text
--host <host>
--port <port>
--token <token>
```

用于排查插件管理器、已安装插件、后端进程和控制服务状态。

## 常用工作流

### 本地开发

```bash
flexcli plugin create
cd my-plugin
npm install
flexcli plugin-v2 dev .
```

### 发布前检查

```bash
flexcli plugin-v2 validate --plugin-dir .
flexcli plugin-v2 build --plugin-dir . --out-dir dist
flexcli plugin-v2 pack --dist-dir dist
```

### 本地安装包测试

```bash
flexcli plugin-v2 install ./release/my-plugin-universal.flexplugin
flexcli plugin-v2 logs @owner/my-plugin
flexcli plugin-v2 reload @owner/my-plugin
```

## 退出码

CLI 命令失败时会以非 0 退出码结束，适合在 CI 中使用。发布前至少应在 CI 中运行：

```bash
flexcli plugin-v2 validate --plugin-dir .
flexcli plugin-v2 build --plugin-dir . --out-dir dist
flexcli plugin-v2 pack --dist-dir dist
```
