const sockets: FakeSocket[] = [];
class FakeSocket {
  readyState = 0;
  handlers: Record<string, Function> = {};
  sent: string[] = [];
  constructor(_url: string) { sockets.push(this); }
  on(event: string, handler: Function) { this.handlers[event] = handler; }
  emit(event: string, value?: unknown) { this.handlers[event]?.(value); }
  send(data: string) { this.sent.push(data); }
  close() {}
}
jest.mock('ws', () => Object.assign(FakeSocket, { OPEN: 1 }));
jest.mock('@flexsdk/runtime', () => ({ FlexPluginBase: class {
  protected hostApi: any; protected logger: any;
  async onLoad(ctx: any) { this.hostApi = ctx.hostApi; this.logger = ctx.logger; }
  async onUnload() {}
  protected registerDependencyApi() {}
  protected unregisterDependencyApi() {}
  protected registerDependencyStateChannel(c: string) { return this.hostApi.plugin.registerDependencyStateChannel(c); }
  protected publishDependencyState(c: string, u: unknown) { return this.hostApi.plugin.publishDependencyState(c, u); }
} }));

import Plugin from '../../src/backend/index';

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const loadedPlugins: Plugin[] = [];
function setup(publish = jest.fn().mockResolvedValue(undefined)) {
  const plugin = new Plugin(); const methods: string[] = [];
  loadedPlugins.push(plugin);
  (plugin as any).registerDependencyApi = (m: string) => methods.push(m);
  const register = jest.fn().mockResolvedValue(undefined);
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return { plugin, methods, register, publish, logger, load: () => plugin.onLoad({ hostApi: { plugin: { registerDependencyStateChannel: register, publishDependencyState: publish } }, logger } as any) };
}

describe('playback dependency state channel', () => {
  beforeEach(() => {
    sockets.length = 0;
    (globalThis as any).fetch = jest.fn().mockRejectedValue(new Error('cover fetch disabled in unit tests'));
  });
  afterEach(async () => { await Promise.all(loadedPlugins.splice(0).map((plugin) => plugin.onUnload())); });
  it('registers before connecting and publishes initial disconnected snapshot while preserving APIs', async () => {
    const x = setup(); await x.load(); await tick();
    expect(x.register).toHaveBeenCalledWith('playback');
    expect(sockets).toHaveLength(1);
    expect(x.publish).toHaveBeenCalledWith('playback', { kind: 'snapshot', payload: expect.objectContaining({ connected: false, song: null, connectionError: null }) });
    expect(x.methods).toEqual(expect.arrayContaining(['getPlaybackState','sendPlayerCommand','getConnectionStatus','installFlexLinkPlugin','openExternalUrl','reportDiagnostic']));
  });

  it('publishes complete compact snapshots for connection and every handled update', async () => {
    const x = setup(); await x.load(); const ws = sockets[0]; ws.readyState = 1; ws.emit('open');
    const messages = [
      ['FullState', { song: { songName: 'A', authorName: 'B', originalCoverUrl: 'https://x/c.jpg', cover: { type: 'Base64', value: 'secret' }, coverBase64: 'secret', extra: 'x'.repeat(70000) }, playState: 'Playing', timeline: { currentTime: 1, totalTime: 2 }, playMode: { isShuffling: true, repeatMode: 'All' }, lyrics: { lines: [{ originalLyric: 'all' }] }, currentLyric: { line: { originalLyric: 'now' } } }],
      ['Metadata', { songName: 'M' }], ['SongUpdate', { songName: 'S' }], ['PlayState', 'Paused'], ['Timeline', { currentTime: 3, totalTime: 4 }], ['PlayMode', { isShuffling: false, repeatMode: 'One' }], ['CurrentLyricUpdate', { line: { originalLyric: 'line' } }]
    ];
    for (const [type, data] of messages) ws.emit('message', JSON.stringify({ type, data }));
    ws.emit('error', new Error('boom')); ws.emit('close'); await tick();
    const payloads = x.publish.mock.calls.map((c) => c[1].payload);
    expect(payloads.some((p) => p.connected && p.playState === 'Playing')).toBe(true);
    expect(payloads.some((p) => p.connectionError === 'boom')).toBe(true);
    for (const p of payloads) { const wire = JSON.stringify(p); expect(Buffer.byteLength(wire)).toBeLessThanOrEqual(64 * 1024); expect(wire).not.toContain('secret'); expect(p).not.toHaveProperty('lyrics'); }
  });

  it('does not publish lyrics-only changes', async () => {
    const x = setup(); await x.load(); x.publish.mockClear(); sockets[0].emit('message', JSON.stringify({ type: 'LyricUpdate', data: { lines: [{ originalLyric: 'hidden' }] } })); await tick();
    expect(x.publish).not.toHaveBeenCalled();
  });

  it('serializes deferred publications and recovers after rejection', async () => {
    const gates: Array<{ resolve(): void; reject(e: Error): void }> = [];
    const publish = jest.fn(() => new Promise<void>((resolve, reject) => gates.push({ resolve, reject })));
    const x = setup(publish); const loading = x.load(); await tick(); expect(publish).toHaveBeenCalledTimes(1); gates[0].resolve(); await loading; await tick();
    const ws = sockets[0]; ws.emit('message', JSON.stringify({ type: 'PlayState', data: 'Playing' })); ws.emit('message', JSON.stringify({ type: 'PlayState', data: 'Paused' })); await tick(); expect(publish).toHaveBeenCalledTimes(2);
    gates[1].reject(new Error('no')); await tick(); expect(publish).toHaveBeenCalledTimes(3); gates[2].resolve(); await tick(); expect(x.logger.warn).toHaveBeenCalled();
  });

  it('publishes a complete snapshot whenever a connection reopens', async () => {
    const x = setup(); await x.load(); const ws = sockets[0]; x.publish.mockClear();
    ws.readyState = 1; ws.emit('open'); ws.emit('message', JSON.stringify({ type: 'PlayState', data: 'Playing' }));
    ws.emit('close'); ws.emit('open'); await tick();
    const snapshots = x.publish.mock.calls.map((call) => call[1].payload);
    expect(snapshots[snapshots.length - 1]).toEqual(expect.objectContaining({ connected: true, playState: 'Playing', timeline: expect.any(Object), playMode: expect.any(Object) }));
  });

  it('fails closed instead of publishing an oversized UTF-8 snapshot', async () => {
    const x = setup(); await x.load(); x.publish.mockClear();
    sockets[0].emit('message', JSON.stringify({ type: 'CurrentLyricUpdate', data: { line: { originalLyric: '歌'.repeat(30000) } } }));
    await tick();
    const payload = x.publish.mock.calls[x.publish.mock.calls.length - 1][1].payload;
    expect(payload).toEqual(expect.objectContaining({ connected: false, song: null, currentLyric: null, connectionError: expect.stringContaining('64 KiB') }));
    expect(Buffer.byteLength(JSON.stringify(payload), 'utf8')).toBeLessThanOrEqual(64 * 1024);
  });
});
