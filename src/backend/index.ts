import { FlexPluginBase } from '@flexsdk/runtime';
import type { PluginDefinitionsPayload, PluginLoadContext } from '@flexsdk/types';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import {
  clonePlaybackState,
  createDefaultPlaybackState,
  NETEASE_MUSIC_LINK_API_VERSION,
  NETEASE_MUSIC_LINK_METHODS,
  NETEASE_MUSIC_LINK_PLUGIN_UUID,
  type GetConnectionStatusOptions,
  type GetPlaybackStateOptions,
  type NeteaseMusicLinkApiInfo,
  type NeteaseMusicLinkConnectionStatus,
  type NeteaseMusicLinkDiagnostic,
  type NeteaseMusicLinkResult,
  type NeteasePlaybackState,
  type NeteasePlayerCommand,
  type NeteaseSong
} from '../common/api';

interface WebSocketLike {
  readyState: number;
  on(event: 'open', handler: () => void): void;
  on(event: 'message', handler: (data: Buffer | string) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  send(data: string): void;
  close(): void;
  terminate?: () => void;
}

interface WebSocketConstructor {
  new(url: string): WebSocketLike;
  OPEN: number;
}

interface FlexLinkMessage {
  type?: string;
  data?: any;
  payload?: any;
}

const WebSocketClient = require('ws') as WebSocketConstructor;
const execFileAsync = promisify(execFile);
const WS_URL = 'ws://127.0.0.1:35010';
const RECONNECT_DELAY_MS = 5000;
const BETTERNCM_PLUGIN_DIR = 'C:\\betterncm\\plugins';
const FLEXLINK_PLUGIN_FILE = 'FlexLink.plugin';
const PLAYER_COMMANDS: NeteasePlayerCommand[] = [
  'togglePlayPause',
  'play',
  'pause',
  'previous',
  'next',
  'togglePlayMode'
];

export default class NeteaseMusicLinkEssentialsPlugin extends FlexPluginBase {
  private ws: WebSocketLike | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private state: NeteasePlaybackState = createDefaultPlaybackState();
  private coverFetchGeneration = 0;
  private coverCache = new Map<string, { value: string; mimeType: string }>();
  private flexLinkMessageCounts = new Map<string, number>();
  private unloaded = false;

  async getDefinitions(): Promise<PluginDefinitionsPayload> {
    return {
      libraries: [],
      units: [],
      revision: String(NETEASE_MUSIC_LINK_API_VERSION)
    };
  }

  async onLoad(ctx: PluginLoadContext): Promise<void> {
    await super.onLoad(ctx);
    this.unloaded = false;
    this.registerDependencyApis();
    this.connectWebSocket();
  }

  async onUnload(): Promise<void> {
    this.unloaded = true;
    this.unregisterDependencyApis();
    this.clearReconnectTimer();
    if (this.ws) {
      try {
        this.ws.close();
        this.ws.terminate?.();
      } catch (error) {
        this.logger.warn('Failed to close FlexLink WebSocket cleanly', { error: String(error) });
      }
      this.ws = null;
    }
    await super.onUnload();
  }

  private registerDependencyApis(): void {
    this.registerDependencyApi(NETEASE_MUSIC_LINK_METHODS.getApiInfo, async () => this.getApiInfo());
    this.registerDependencyApi(NETEASE_MUSIC_LINK_METHODS.getPlaybackState, async (options?: GetPlaybackStateOptions) =>
      this.getPlaybackState(options)
    );
    this.registerDependencyApi(
      NETEASE_MUSIC_LINK_METHODS.getConnectionStatus,
      async (options?: GetConnectionStatusOptions) => this.getConnectionStatus(options)
    );
    this.registerDependencyApi(NETEASE_MUSIC_LINK_METHODS.sendPlayerCommand, async (command: unknown) =>
      this.sendPlayerCommand(command)
    );
    this.registerDependencyApi(NETEASE_MUSIC_LINK_METHODS.installFlexLinkPlugin, async () =>
      this.installFlexLinkPlugin()
    );
    this.registerDependencyApi(NETEASE_MUSIC_LINK_METHODS.openExternalUrl, async (url: unknown) =>
      this.openExternalUrl(url)
    );
    this.registerDependencyApi(NETEASE_MUSIC_LINK_METHODS.reportDiagnostic, async (diagnostic: unknown) =>
      this.reportDiagnostic(diagnostic)
    );
  }

  private unregisterDependencyApis(): void {
    Object.values(NETEASE_MUSIC_LINK_METHODS).forEach((method) => this.unregisterDependencyApi(method));
  }

  private getApiInfo(): NeteaseMusicLinkApiInfo {
    return {
      providerUUID: NETEASE_MUSIC_LINK_PLUGIN_UUID,
      apiVersion: NETEASE_MUSIC_LINK_API_VERSION,
      flexLinkWebSocketUrl: WS_URL,
      capabilities: [
        'playback-state',
        'player-control',
        'cover-base64',
        'flexlink-install',
        'diagnostics'
      ]
    };
  }

  private getPlaybackState(options?: GetPlaybackStateOptions): NeteasePlaybackState {
    if (options?.ensureConnected && !this.state.connected) {
      this.connectWebSocket();
    }
    return clonePlaybackState(this.state);
  }

  private getConnectionStatus(options?: GetConnectionStatusOptions): NeteaseMusicLinkConnectionStatus {
    if (options?.connect !== false && !this.state.connected) {
      this.connectWebSocket();
    }
    return {
      connected: this.state.connected,
      currentSong: this.state.song?.songName ?? null,
      lastUpdatedAt: this.state.lastUpdatedAt,
      error: this.state.connectionError,
      webSocketUrl: WS_URL
    };
  }

  private async sendPlayerCommand(command: unknown): Promise<NeteaseMusicLinkResult> {
    if (!this.isPlayerCommand(command)) {
      return { success: false, error: `Unsupported command: ${String(command)}` };
    }

    if (!this.state.connected) {
      this.connectWebSocket();
      return { success: false, error: 'FlexLink is not connected. Start Netease Music and BetterNCM, then retry.' };
    }

    const commandType = this.resolveFlexLinkCommandType(command);
    if (!commandType) {
      return { success: false, error: `Unsupported command: ${command}` };
    }

    const sent = this.sendFlexLinkCommand({ type: commandType });
    return sent ? { success: true } : { success: false, error: 'FlexLink WebSocket is not ready.' };
  }

  private isPlayerCommand(value: unknown): value is NeteasePlayerCommand {
    return typeof value === 'string' && PLAYER_COMMANDS.includes(value as NeteasePlayerCommand);
  }

  private resolveFlexLinkCommandType(command: NeteasePlayerCommand): string | null {
    switch (command) {
      case 'togglePlayPause':
        return this.isPlaying() ? 'Pause' : 'Play';
      case 'play':
        return 'Play';
      case 'pause':
        return 'Pause';
      case 'previous':
        return 'PreviousSong';
      case 'next':
        return 'NextSong';
      case 'togglePlayMode':
        return 'TogglePlayMode';
      default:
        return null;
    }
  }

  private isPlaying(): boolean {
    const playState = String(this.state.playState ?? '').toLowerCase();
    return playState.includes('play') && !playState.includes('pause') && !playState.includes('stop');
  }

  private async installFlexLinkPlugin(): Promise<NeteaseMusicLinkResult> {
    const sourcePath = this.resolvePackagedAsset(FLEXLINK_PLUGIN_FILE);
    if (!sourcePath) {
      return { success: false, error: 'Packaged FlexLink.plugin asset was not found.' };
    }

    const targetPath = path.join(BETTERNCM_PLUGIN_DIR, FLEXLINK_PLUGIN_FILE);
    try {
      await fs.promises.mkdir(BETTERNCM_PLUGIN_DIR, { recursive: true });
      await fs.promises.copyFile(sourcePath, targetPath);
      this.logger.info('FlexLink BetterNCM plugin installed', { targetPath });
      return { success: true, targetPath };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to install FlexLink BetterNCM plugin', { error: message, targetPath });
      return { success: false, error: message, targetPath };
    }
  }

  private resolvePackagedAsset(fileName: string): string | null {
    const candidates = [
      path.resolve(__dirname, '../../assets', fileName),
      path.resolve(__dirname, '../assets', fileName),
      path.resolve(process.cwd(), 'assets', fileName),
      path.resolve(process.cwd(), 'dist/assets', fileName)
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
  }

  private async openExternalUrl(url: unknown): Promise<NeteaseMusicLinkResult> {
    if (typeof url !== 'string' || !url.trim()) {
      return { success: false, error: 'URL is required.' };
    }

    try {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        return { success: false, error: 'Only http(s) URLs can be opened.' };
      }
      await execFileAsync('cmd', ['/c', 'start', '', parsed.toString()], { windowsHide: true });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('Failed to open external URL', { url, error: message });
      return { success: false, error: message };
    }
  }

  private reportDiagnostic(diagnostic: unknown): NeteaseMusicLinkResult {
    const record = this.asRecord(diagnostic);
    const event = this.readString(record?.event) ?? 'unknown';
    const payload: NeteaseMusicLinkDiagnostic = {
      event,
      sourcePluginUUID: this.readString(record?.sourcePluginUUID),
      sourceUnitTypeId: this.readString(record?.sourceUnitTypeId),
      viewKind: this.readString(record?.viewKind),
      songName: this.readString(record?.songName),
      coverSourceKind: this.readString(record?.coverSourceKind),
      coverSourceLength: Number(record?.coverSourceLength ?? 0),
      coverPreview: this.readString(record?.coverPreview)?.slice(0, 120) ?? null,
      error: this.readString(record?.error)
    };

    if (event.includes('error')) {
      this.logger.warn('NeteaseMusicLink consumer diagnostic', payload);
      return { success: true };
    }

    this.logger.info('NeteaseMusicLink consumer diagnostic', payload);
    return { success: true };
  }

  private connectWebSocket(): void {
    if (this.unloaded) return;
    if (this.ws?.readyState === WebSocketClient.OPEN) return;

    try {
      this.ws = new WebSocketClient(WS_URL);

      this.ws.on('open', () => {
        this.clearReconnectTimer();
        this.state.connected = true;
        this.state.connectionError = null;
        this.state.lastUpdatedAt = Date.now();
        this.sendFlexLinkCommand({ type: 'GetState' });
        this.logger.info(`Connected to Netease FlexLink at ${WS_URL}`);
      });

      this.ws.on('message', (data: Buffer | string) => {
        try {
          const message = JSON.parse(data.toString()) as FlexLinkMessage;
          this.handleFlexLinkMessage(message);
        } catch (error) {
          this.logger.warn('Failed to parse Netease FlexLink message', { error: String(error) });
        }
      });

      this.ws.on('close', () => {
        this.state.connected = false;
        this.state.lastUpdatedAt = Date.now();
        this.scheduleReconnect();
      });

      this.ws.on('error', (error: Error) => {
        this.state.connected = false;
        this.state.connectionError = error.message;
        this.state.lastUpdatedAt = Date.now();
        this.logger.warn('Netease FlexLink WebSocket error', { error: error.message });
      });
    } catch (error) {
      this.state.connected = false;
      this.state.connectionError = error instanceof Error ? error.message : String(error);
      this.state.lastUpdatedAt = Date.now();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.unloaded || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket();
    }, RECONNECT_DELAY_MS);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private handleFlexLinkMessage(message: FlexLinkMessage): void {
    const payload = message.data ?? message.payload;
    const handled = this.applyFlexLinkMessage(message.type, payload);
    this.logFlexLinkMessage(message, payload, handled);
  }

  private applyFlexLinkMessage(type: string | undefined, payload: any): boolean {
    switch (type) {
      case 'FullState':
        this.setSong(payload?.song ?? null, type);
        this.state.playState = payload?.playState ?? payload?.playStatus ?? 'Stopped';
        this.state.timeline = payload?.timeline ?? { currentTime: 0, totalTime: 0 };
        this.state.playMode = payload?.playMode ?? { isShuffling: false, repeatMode: 'Off' };
        this.state.lyrics = payload?.lyrics ?? this.state.lyrics;
        this.state.currentLyric = payload?.currentLyric ?? this.state.currentLyric;
        break;
      case 'Metadata':
      case 'SongUpdate':
        this.setSong(payload ?? null, type);
        break;
      case 'PlayState':
      case 'PlayStateUpdate':
        this.state.playState = typeof payload === 'string' ? payload : payload?.status ?? 'Stopped';
        break;
      case 'Timeline':
      case 'TimelineUpdate':
        this.state.timeline = {
          currentTime: Number(payload?.currentTime ?? 0),
          totalTime: Number(payload?.totalTime ?? 0)
        };
        break;
      case 'PlayMode':
      case 'PlayModeUpdate':
        this.state.playMode = {
          isShuffling: Boolean(payload?.isShuffling),
          repeatMode: String(payload?.repeatMode ?? 'Off')
        };
        break;
      case 'UpdateLyric':
      case 'LyricUpdate':
        this.state.lyrics = payload ?? null;
        break;
      case 'UpdateCurrentLyric':
      case 'CurrentLyricUpdate':
        this.state.currentLyric = payload ?? null;
        break;
      default:
        return false;
    }

    this.state.connected = true;
    this.state.connectionError = null;
    this.state.lastUpdatedAt = Date.now();
    return true;
  }

  private setSong(song: NeteaseSong | null, source: string): void {
    this.coverFetchGeneration += 1;
    this.state.song = song;
    this.logSongCoverSummary(song, source);
    void this.ensureBackendCoverData(song, source, this.coverFetchGeneration);
  }

  private async ensureBackendCoverData(
    song: NeteaseSong | null,
    source: string,
    generation: number
  ): Promise<void> {
    const url = this.resolveCoverFetchUrl(song);
    if (!song || !url) return;
    if (!/^https?:\/\//i.test(url)) {
      this.logger.warn('Netease cover URL is not fetchable by the backend', {
        source,
        coverUrl: this.summarizeUrl(url),
        coverType: this.describeCover(song).coverType
      });
      return;
    }

    const cached = this.coverCache.get(url);
    if (cached) {
      this.applyFetchedCover(cached.value, cached.mimeType, generation, source, true);
      return;
    }

    this.logger.info('Fetching Netease cover for backend data URL conversion', {
      source,
      songName: song.songName ?? null,
      coverUrl: this.summarizeUrl(url)
    });

    try {
      const response = await fetch(url, { redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());

      const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      if (!base64) throw new Error('Empty cover response body');

      this.coverCache.set(url, { value: base64, mimeType });
      this.applyFetchedCover(base64, mimeType, generation, source, false);
    } catch (error) {
      this.logger.warn('Failed to fetch Netease cover for backend data URL conversion', {
        source,
        songName: song.songName ?? null,
        coverUrl: this.summarizeUrl(url),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private applyFetchedCover(
    base64: string,
    mimeType: string,
    generation: number,
    source: string,
    fromCache: boolean
  ): void {
    if (generation !== this.coverFetchGeneration || !this.state.song) return;

    this.state.song = {
      ...this.state.song,
      cover: { type: 'Base64', value: base64 },
      coverMimeType: mimeType,
      originalCoverUrl: this.state.song.originalCoverUrl ?? this.resolveCoverFetchUrl(this.state.song)
    };
    this.state.lastUpdatedAt = Date.now();
    this.logger.info('Netease cover is ready as backend data URL', {
      source,
      songName: this.state.song.songName ?? null,
      mimeType,
      base64Length: base64.length,
      fromCache
    });
  }

  private resolveCoverFetchUrl(song: NeteaseSong | null): string {
    if (!song) return '';

    const cover = song.cover;
    if (typeof cover === 'string') return /^https?:\/\//i.test(cover) ? cover : '';
    if (cover?.type === 'Url' && cover.value) return cover.value;

    return (
      song.originalCoverUrl ??
      song.coverUrl ??
      song.picUrl ??
      song.album?.picUrl ??
      song.album?.coverUrl ??
      ''
    );
  }

  private describeCover(song: NeteaseSong | null): {
    hasCover: boolean;
    coverType: string | null;
    coverValueLength: number;
    coverSource: string | null;
  } {
    if (!song) return { hasCover: false, coverType: null, coverValueLength: 0, coverSource: null };

    const cover = song.cover;
    if (typeof cover === 'string') {
      return {
        hasCover: cover.length > 0,
        coverType: cover.startsWith('data:') ? 'DataUrlString' : /^https?:\/\//i.test(cover) ? 'UrlString' : 'Base64String',
        coverValueLength: cover.length,
        coverSource: this.summarizeUrl(cover)
      };
    }

    const fallbackUrl = this.resolveCoverFetchUrl(song);
    return {
      hasCover: Boolean(cover?.value || song.coverBase64 || fallbackUrl),
      coverType: cover?.type ?? (song.coverBase64 ? 'coverBase64' : fallbackUrl ? 'FallbackUrl' : null),
      coverValueLength: cover?.value?.length ?? song.coverBase64?.length ?? fallbackUrl.length,
      coverSource: cover?.type === 'Url' ? this.summarizeUrl(cover.value ?? '') : fallbackUrl ? this.summarizeUrl(fallbackUrl) : null
    };
  }

  private logSongCoverSummary(song: NeteaseSong | null, source: string): void {
    const cover = this.describeCover(song);
    this.logger.info('Netease song metadata received', {
      source,
      songName: song?.songName ?? null,
      authorName: song?.authorName ?? null,
      albumName: song?.albumName ?? null,
      ncmId: song?.ncmId ?? null,
      ...cover
    });
  }

  private logFlexLinkMessage(message: FlexLinkMessage, payload: any, handled: boolean): void {
    const type = message.type ?? 'unknown';
    const count = (this.flexLinkMessageCounts.get(type) ?? 0) + 1;
    this.flexLinkMessageCounts.set(type, count);
    if (handled && count > 3) return;

    this.logger.info('Netease FlexLink message received', {
      type,
      handled,
      count,
      hasData: message.data !== undefined,
      hasPayload: message.payload !== undefined,
      payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload).slice(0, 12) : []
    });
  }

  private sendFlexLinkCommand(command: Record<string, any>): boolean {
    if (this.ws?.readyState !== WebSocketClient.OPEN) return false;
    this.ws.send(JSON.stringify(command));
    return true;
  }

  private asRecord(value: unknown): Record<string, any> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, any>)
      : null;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private summarizeUrl(value: string): string {
    if (!value) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value.slice(0, 80);
    try {
      const parsed = new URL(value);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.slice(0, 160);
    } catch {
      return value.slice(0, 160);
    }
  }
}
