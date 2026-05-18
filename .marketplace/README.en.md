# NeteaseMusicLinkEssentials

Reusable Windows-only FlexLink communication layer for FlexStudio Netease Cloud Music plugins.

It exposes dependency API methods for playback state, player commands, lyrics, cover conversion, BetterNCM FlexLink installation, and diagnostics. It does not register user-facing Units; install it as a dependency for plugins such as NeteaseMusic.

Consumers need `pluginApi` permission and a direct dependency on `@aspen/netease-music-link-essentials`.
