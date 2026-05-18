export const NETEASE_MUSIC_LINK_PLUGIN_UUID = '@aspen/netease-music-link-essentials';
export const NETEASE_MUSIC_LINK_API_VERSION = 1;

export const NETEASE_MUSIC_LINK_METHODS = {
  getApiInfo: 'getApiInfo',
  getPlaybackState: 'getPlaybackState',
  getConnectionStatus: 'getConnectionStatus',
  sendPlayerCommand: 'sendPlayerCommand',
  installFlexLinkPlugin: 'installFlexLinkPlugin',
  openExternalUrl: 'openExternalUrl',
  reportDiagnostic: 'reportDiagnostic'
} as const;

export type NeteaseMusicLinkMethod =
  (typeof NETEASE_MUSIC_LINK_METHODS)[keyof typeof NETEASE_MUSIC_LINK_METHODS];

export type NeteasePlayerCommand =
  | 'togglePlayPause'
  | 'play'
  | 'pause'
  | 'previous'
  | 'next'
  | 'togglePlayMode';

export interface NeteaseCover {
  type?: 'Base64' | 'Url' | string;
  value?: string;
}

export interface NeteaseSong {
  songName?: string;
  authorName?: string;
  albumName?: string;
  ncmId?: number;
  duration?: number;
  cover?: NeteaseCover | string | null;
  coverBase64?: string;
  coverMimeType?: string;
  originalCoverUrl?: string;
  coverUrl?: string;
  picUrl?: string;
  album?: {
    picUrl?: string;
    coverUrl?: string;
  };
}

export interface NeteaseTimelineState {
  currentTime: number;
  totalTime: number;
}

export interface NeteasePlayModeState {
  isShuffling: boolean;
  repeatMode: string;
}

export interface NeteaseLyricLine {
  originalLyric?: string;
  translatedLyric?: string;
}

export interface NeteaseCurrentLyricState {
  lineIndex?: number;
  wordIndex?: number;
  line?: NeteaseLyricLine;
  nextLine?: NeteaseLyricLine;
}

export interface NeteaseLyricsState {
  lines?: NeteaseLyricLine[];
  hasDynamicLyric?: boolean;
}

export interface NeteasePlaybackState {
  connected: boolean;
  song: NeteaseSong | null;
  playState: string;
  timeline: NeteaseTimelineState;
  playMode: NeteasePlayModeState;
  lyrics: NeteaseLyricsState | null;
  currentLyric: NeteaseCurrentLyricState | null;
  lastUpdatedAt: number;
  connectionError: string | null;
}

export interface NeteaseMusicLinkApiInfo {
  providerUUID: string;
  apiVersion: number;
  flexLinkWebSocketUrl: string;
  capabilities: string[];
}

export interface NeteaseMusicLinkConnectionStatus {
  connected: boolean;
  currentSong: string | null;
  lastUpdatedAt: number;
  error: string | null;
  webSocketUrl: string;
}

export interface GetPlaybackStateOptions {
  ensureConnected?: boolean;
}

export interface GetConnectionStatusOptions {
  connect?: boolean;
}

export interface NeteaseMusicLinkResult {
  success: boolean;
  error?: string;
  targetPath?: string;
}

export interface NeteaseMusicLinkDiagnostic {
  event: string;
  sourcePluginUUID: string | null;
  sourceUnitTypeId: string | null;
  viewKind: string | null;
  songName: string | null;
  coverSourceKind: string | null;
  coverSourceLength: number;
  coverPreview: string | null;
  error: string | null;
}

export const DEFAULT_PLAYBACK_STATE: NeteasePlaybackState = {
  connected: false,
  song: null,
  playState: 'Stopped',
  timeline: { currentTime: 0, totalTime: 0 },
  playMode: { isShuffling: false, repeatMode: 'Off' },
  lyrics: null,
  currentLyric: null,
  lastUpdatedAt: 0,
  connectionError: null
};

export function createDefaultPlaybackState(): NeteasePlaybackState {
  return {
    ...clonePlaybackState(DEFAULT_PLAYBACK_STATE),
    lastUpdatedAt: Date.now()
  };
}

export function clonePlaybackState(state: NeteasePlaybackState): NeteasePlaybackState {
  return JSON.parse(JSON.stringify(state)) as NeteasePlaybackState;
}
