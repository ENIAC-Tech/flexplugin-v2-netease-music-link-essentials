# 发布到插件市场

FlexStudio 插件市场的发布模型基于 GitHub Release。插件必须开源在 GitHub，市场不接受 CLI 直接上传发布。CLI 负责本地构建和打包；正式发布由 GitHub Actions 在 Release 发布时完成。

## 发布模型

核心规则：

- 插件源代码托管在 GitHub。
- 插件版本来自 GitHub Release tag，不来自 `manifest.json`。
- `.flexplugin` 包作为 GitHub Release Asset 上传。
- 插件市场通过 webhook 得知 Release 已发布。
- 市场服务端只把 webhook 作为通知，会独立从 GitHub Release 拉取和校验包。
- 历史版本保留在 GitHub Releases；市场侧保存最新 CDN 包。
- workflow 必须固定到官方 reusable workflow 的版本 tag，不能使用 `@main`。

## 发布前检查

发布前在本地执行：

```bash
flexcli plugin-v2 validate --plugin-dir .
flexcli plugin-v2 build --plugin-dir . --out-dir dist
flexcli plugin-v2 pack --dist-dir dist
```

确认：

- `manifest.json` 中 `uuid` 稳定且唯一。
- `repo` 指向 GitHub 仓库。
- `entry` 指向构建产物路径。
- `permissions` 只包含实际需要的权限。
- `native` 与 `platforms` 设置正确。
- `.marketplace/README.{lang}.md` 已准备好。
- GitHub Release tag 使用语义化版本，例如 `v1.2.0`。

## Marketplace README

市场详情页按语言读取：

1. `.marketplace/README.{lang}.md`
2. 仓库根目录 `README.md`

建议至少提供：

- 插件简介。
- 主要功能。
- 支持设备和平台。
- 权限说明。
- 安装和使用方式。
- 配置说明。
- 常见问题和故障排查。
- 版本兼容说明。

## GitHub Actions workflow

在插件仓库创建 `.github/workflows/publish.yml`：

```yaml
name: Publish to FlexStudio Marketplace

on:
  release:
    types: [published]

jobs:
  publish:
    uses: ENIAC-Tech/flex-plugin-actions/.github/workflows/publish.yml@v1.1.0
    with:
      flexcli-package: "https://github.com/ENIAC-Tech/flexcli/tarball/refs/heads/v2"
      # api-base-url: "https://api.enilinx.com"
    secrets:
      webhook-secret: ${{ secrets.FLEX_MARKETPLACE_WEBHOOK_SECRET }}
```

不要使用：

```yaml
uses: ENIAC-Tech/flex-plugin-actions/.github/workflows/publish.yml@main
```

市场服务端会拒绝使用可变 ref 的 workflow。

## Webhook secret

发布前需要在 FlexStudio 插件市场中注册插件或进入上传管理，获取 webhook secret。然后在 GitHub 仓库中添加 Actions secret：

```text
FLEX_MARKETPLACE_WEBHOOK_SECRET=<secret from FlexStudio marketplace>
```

位置：

```text
GitHub repository -> Settings -> Secrets and variables -> Actions -> New repository secret
```

workflow 会用该 secret 对 webhook payload 做 HMAC-SHA256 签名。

## Workflow 输入

| 输入 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `flexcli-package` | 否 | `https://github.com/ENIAC-Tech/flexcli/tarball/refs/heads/v2` | 传给 `npm install -g` 的 FlexCLI 包地址或版本。 |
| `api-base-url` | 否 | `https://api.enilinx.com` | 插件市场 API 地址。可只写 hostname，会默认使用 `https`。 |

## Workflow secret

| Secret | 必填 | 说明 |
| --- | --- | --- |
| `webhook-secret` | 是 | 市场 webhook HMAC-SHA256 密钥。通常映射到仓库 secret `FLEX_MARKETPLACE_WEBHOOK_SECRET`。 |

## 非 native 插件

`native` 不是 `true` 时，workflow 会：

1. 在 Ubuntu runner 上安装依赖。
2. 安装 FlexCLI。
3. 执行 `npm run build`。
4. 执行 `flexcli plugin-v2 pack`。
5. 生成 universal `.flexplugin`。
6. 上传到 GitHub Release。
7. 通知市场。

## Native 插件

`manifest.json` 中设置：

```json
{
  "native": true,
  "platforms": ["win32-x64", "darwin-arm64", "darwin-x64", "linux-x64"]
}
```

workflow 会按平台矩阵构建：

| 平台 | Runner |
| --- | --- |
| `win32-x64` | `windows-latest` |
| `darwin-arm64` | `macos-latest` |
| `darwin-x64` | `macos-13` |
| `linux-x64` | `ubuntu-latest` |

每个平台会执行：

```bash
npm ci
npm install -g <flexcli-package>
npm run build
flexcli plugin-v2 pack --platform <platform>
```

## Webhook payload

workflow 通知市场的 payload 包含：

```json
{
  "repo_url": "https://github.com/owner/repo",
  "tag": "v1.2.0",
  "manifest_uuid": "@owner/repo",
  "delivery_id": "<github-run-id>-<attempt>",
  "timestamp": 1710000000
}
```

请求头包含：

```text
X-Hub-Signature-256: sha256=<hmac>
```

市场服务端会检查：

- HMAC-SHA256 签名。
- 仓库与插件绑定关系。
- 时间戳和 delivery id，防止重放。
- GitHub Release 资产是否存在且可下载。
- `.flexplugin` 包和 manifest 是否有效。

## 首次发布

官方 workflow 包含首次发布 gate：如果当前 Release 是仓库第一个已发布的非 draft Release，workflow 会跳过 marketplace notify。

这样做是为了支持先创建 Release Asset，再在市场中完成首次注册或审核流程。首次注册完成后，后续 Release 会自动通知市场。

## 依赖发布

插件可以在 manifest 中声明依赖：

```json
{
  "dependencies": [
    {
      "uuid": "@acme/base-plugin",
      "minVersion": "1.2.0"
    }
  ]
}
```

市场安装时会解析依赖：

- 当前只支持 `>= minVersion`。
- 最大依赖深度为 6。
- 被其他插件依赖的插件不能直接删除，只能归档。
- 归档插件不会出现在搜索中，但仍可作为依赖被安装。

## 更新与 Unit 迁移

插件版本来自 GitHub Release tag。通过市场安装或更新插件时，FlexStudio 会把安装来源的 `marketplaceListingId` 和当前版本写入本地插件状态；项目和 preset 中的插件 Unit 则保存创建或迁移时的 `unit.plugin.pluginVersion`。

用户侧更新入口包括：

- 启动时自动静默检查已安装的市场插件更新，并在发现可更新版本时提示。
- 插件安装管理页的 “Check all updates” 按钮，手动检查全部市场来源插件。
- 插件设置页的 “Check update” 按钮，手动检查单个市场来源插件。
- 打开项目时，根据 preset 的 `pluginDependencies` 汇总缺失和版本不足的插件，并提示进入对应 Marketplace 插件页。

更新完成后，FlexStudio 会对当前项目中的旧版本插件 Unit 调用新版本插件后端的 `migrateUnit()` Hook。未提供 Hook 时按 no-op 处理，只更新 Unit 中的插件版本。插件作者发布会改变 Unit 数据结构的版本时，应在发布说明和 Marketplace README 中写清楚数据变化，并提供幂等迁移逻辑。

发布破坏性 Unit 数据变更前，建议本地验证：

1. 用旧版本插件创建项目并添加相关 Unit。
2. 安装或更新到新版本插件。
3. 打开旧项目，确认 `migrateUnit()` 被调用，旧 Unit 数据迁移成功。
4. 检查插件日志和项目中的 Unit 行为。

## 归档、删除和恢复

市场中的插件有删除和归档规则：

- 没有被依赖的叶子插件可以删除。
- 有依赖方的插件不能删除，只能归档。
- 归档插件默认从搜索和普通列表中隐藏。
- 归档插件仍可作为依赖被解析和安装。
- 取消归档需要重新审核。

## 市场管理能力

FlexStudio 市场客户端支持：

- 获取插件列表和详情。
- 查看版本列表。
- 收藏、评分、举报。
- 查看自己的上传。
- 下载、安装、卸载和级联卸载。
- 检查更新、忽略更新。
- 获取或重新生成 webhook secret。
- 测试 webhook 连接。
- 更新市场 metadata。
- 上传和提交 banner。
- 发布、归档、取消归档、删除 listing。
- 检查依赖安装计划和卸载影响。

插件作者通常通过 FlexStudio 市场 UI 使用这些能力，不需要直接调用内部 IPC。
