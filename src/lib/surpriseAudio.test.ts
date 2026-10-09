import {afterEach, describe, expect, it, vi} from 'vitest';
import {SurpriseAudio} from './surpriseAudio';

afterEach(() => vi.unstubAllGlobals());
function setup() {
  const sources: {buffer: unknown; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>}[] = [];
  const decoded = {duration: 1};
  const context = {
    state: 'running', sampleRate: 44100, destination: {},
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    createBuffer: vi.fn(() => ({silent: true})),
    decodeAudioData: vi.fn(() => Promise.resolve(decoded)),
    createBufferSource: vi.fn(() => {
      const source = {buffer: null, start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn()};
      sources.push(source);
      return source;
    }),
  };
  vi.stubGlobal('window', {AudioContext: class {constructor() {return context;}}});
  const fetchMock = vi.fn(() => Promise.resolve({ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8))}));
  vi.stubGlobal('fetch', fetchMock);
  return {context, sources, decoded, fetchMock, audio: new SurpriseAudio()};
}
describe('prepared surprise audio', () => {
  it('selects the playback audio session on supported iPhones', () => {
    const {audio} = setup();
    const session = {type: 'ambient'};
    vi.stubGlobal('navigator', {audioSession: session});
    audio.unlock();
    expect(session.type).toBe('playback');
  });
  it('waits for both decoding and resume before starting the real sound', async () => {
    const {audio, context, sources, decoded} = setup();
    context.state = 'suspended';
    let finishResume!: () => void;
    context.resume.mockImplementation(() => new Promise<void>(resolve => {finishResume = resolve;}));
    const started = audio.start();
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalled());
    expect(sources.some(source => source.buffer === decoded)).toBe(false);
    context.state = 'running';
    finishResume();
    expect(await started).toBe(true);
    expect(sources.some(source => source.buffer === decoded)).toBe(true);
  });
  it('cancels a delayed audio start when the display is closed', async () => {
    const {audio, context, sources, decoded} = setup();
    context.state = 'suspended';
    let finishResume!: () => void;
    context.resume.mockImplementation(() => new Promise<void>(resolve => {finishResume = resolve;}));
    const started = audio.start();
    audio.stop();
    context.state = 'running';
    finishResume();
    expect(await started).toBe(false);
    expect(sources.some(source => source.buffer === decoded)).toBe(false);
  });
  it('resumes synchronously, prepares once, and never plays the real audio during unlocking', async () => {
    const {audio, context, sources, decoded, fetchMock} = setup();
    audio.unlock();
    expect(context.resume).toHaveBeenCalledTimes(1);
    audio.unlock();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(audio.ready).toBe(true));
    expect(sources.every(source => source.buffer !== decoded)).toBe(true);
    expect(sources).toHaveLength(2);
  });
  it('starts the decoded sound at the video offset and stops it when closing', async () => {
    const {audio, sources, decoded} = setup();
    audio.unlock();
    await vi.waitFor(() => expect(audio.ready).toBe(true));
    expect(audio.play(0.04)).toBe(true);
    const real = sources[sources.length - 1];
    expect(real.buffer).toBe(decoded);
    expect(real.start).toHaveBeenCalledWith(0, 0.04);
    audio.stop();
    audio.stop();
    expect(real.stop).toHaveBeenCalledTimes(1);
    expect(real.disconnect).toHaveBeenCalledTimes(1);
  });
  it('does not pretend to play when audio is unavailable or suspended', async () => {
    const {audio, context} = setup();
    expect(audio.play()).toBe(false);
    audio.unlock();
    await vi.waitFor(() => expect(audio.ready).toBe(true));
    context.state = 'suspended';
    expect(audio.play()).toBe(false);
    audio.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
