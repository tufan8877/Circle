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
