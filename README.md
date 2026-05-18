# NeteaseMusicLinkEssentials

Reusable FlexLink communication essentials for FlexStudio Netease Cloud Music plugins.

This plugin exposes a backend dependency API for playback state, player controls, lyrics, cover data, BetterNCM FlexLink installation, and diagnostics. It is Windows-only and does not register user-facing Units by itself.

## Consumer Manifest

Consumers must declare this plugin as a direct dependency and request `pluginApi`:

```json
{
  "permissions": ["logger", "pluginApi"],
  "dependencies": [
    {
      "uuid": "@aspen/netease-music-link-essentials",
      "minVersion": "1.0.0"
    }
  ]
}
```

## API

Import or copy the TypeScript contract from `src/common/api.ts`. Public methods are registered through FlexStudio dependency API:

```ts
const state = await this.hostApi.plugin.callDependency(
  '@aspen/netease-music-link-essentials',
  'getPlaybackState',
  [{ ensureConnected: true }]
)
```

| Method | Parameters | Returns |
| --- | --- | --- |
| `getApiInfo` | none | Provider UUID, API version, WebSocket URL, capabilities |
| `getPlaybackState` | `{ ensureConnected?: boolean }` | Current song, play state, timeline, play mode, lyrics, current lyric, connection status |
| `getConnectionStatus` | `{ connect?: boolean }` | Lightweight connection status and current song |
| `sendPlayerCommand` | `togglePlayPause`, `play`, `pause`, `previous`, `next`, `togglePlayMode` | `{ success, error? }` |
| `installFlexLinkPlugin` | none | Copies bundled `FlexLink.plugin` to `C:\betterncm\plugins` |
| `openExternalUrl` | `http(s)` URL | Opens a documentation or download URL |
| `reportDiagnostic` | diagnostic object | Writes consumer diagnostics into provider logs |

Cover URLs received from FlexLink are fetched by the backend and normalized into base64 payloads when possible, so consumers can render album art under FlexStudio iframe CSP rules.

## Development

Use the SDK-generated workflow:

```bash
npm install
npm run build
npm run pack
```

`npm run dev` connects the plugin to a running FlexStudio instance.

## Release

The package is Windows-only and is packed with `--platform win32-x64`.

## Agent Skill

This repository keeps the SDK-generated `.agents/skills/flexstudio-plugin-developer/` docs snapshot for future plugin maintenance.
