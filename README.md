# NeteaseMusicLinkEssentials

Reusable FlexLink communication essentials for FlexStudio Netease Cloud Music plugins.

This plugin exposes an event-driven playback channel plus dependency RPCs for diagnostics, player controls, BetterNCM FlexLink installation, and utilities. It is Windows-only and does not register user-facing Units by itself.

## Consumer Manifest

Consumers must declare this plugin as a direct dependency and request `pluginApi`:

```json
{
  "permissions": ["logger", "pluginApi"],
  "dependencies": [
    {
      "uuid": "@aspen/netease-music-link-essentials",
      "minVersion": "1.0.1"
    }
  ]
}
```

## Playback Dependency State Channel

Consumers subscribe to the retained `playback` Dependency State Channel with `replayLatest: true`. The provider publishes compact snapshots after FlexLink connection and playback events. The payload is `NeteasePlaybackChannelState`: connection status/error, compact song metadata with bounded HTTP(S) cover URLs, play state, timeline, play mode, the current/next lyric excerpt, and `lastUpdatedAt`.

The channel deliberately excludes the full lyrics collection and base64 cover data so it remains below the 64 KiB State Channel limit. Consumers must not poll playback state. `getPlaybackState` remains available only as an explicit diagnostic snapshot; it is not the live state transport.

## Dependency RPC API

Import or copy the TypeScript contract from `src/common/api.ts`. Public methods are registered through FlexStudio dependency API:

```ts
const diagnosticSnapshot = await this.hostApi.plugin.callDependency(
  '@aspen/netease-music-link-essentials',
  'getPlaybackState',
  [{ ensureConnected: true }]
)
```

| Method | Parameters | Returns |
| --- | --- | --- |
| `getApiInfo` | none | Provider UUID, API version, WebSocket URL, capabilities |
| `getPlaybackState` | `{ ensureConnected?: boolean }` | Explicit diagnostic snapshot, including full lyrics and available cover data; never a polling feed |
| `getConnectionStatus` | `{ connect?: boolean }` | Lightweight connection status and current song |
| `sendPlayerCommand` | `togglePlayPause`, `play`, `pause`, `previous`, `next`, `togglePlayMode` | `{ success, error? }` |
| `installFlexLinkPlugin` | none | Copies bundled `FlexLink.plugin` to `C:\betterncm\plugins` |
| `openExternalUrl` | `http(s)` URL | Opens a documentation or download URL |
| `reportDiagnostic` | diagnostic object | Writes consumer diagnostics into provider logs |

Player actions remain commands through the `sendPlayerCommand` RPC. Installation, URL opening, connection checks, and diagnostic reporting also remain request/response RPCs; they are not State Channel messages.

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
