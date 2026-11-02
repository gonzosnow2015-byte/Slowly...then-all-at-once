const crunchUrl = new URL("./crunch.wav", import.meta.url).href;
const jetUrl = new URL("./jet-jump.wav", import.meta.url).href;
const shoutUrl = new URL("./go-monchel.mp3", import.meta.url).href;
const TRACKS = [
  "/music/lush-lagoon.mp3",
  "/music/jazz-the-dust.mp3",
  "/music/glass-heart.mp3",
  "/music/deep-house-afro.mp3",
  "/music/90s-retro.mp3",
];

/** Slider percents. Music starts a step under effects. */
export const MUSIC_PERCENT = 52;
export const EFFECTS_PERCENT = 70;
const MUSIC_AT_DEFAULT = 0.15;

export function createSfx() {
  let ctx: AudioContext | null = null;
  let muted = false;
  let musicMuted = false;
  let musicStarted = false;
  let previewing = false;
  let previewLoud = false;
  let trackIndex = 0;
  let musicPercent = MUSIC_PERCENT;
  let effectsPercent = EFFECTS_PERCENT;
  let music: HTMLAudioElement | null = null;
  let crunchBuf: AudioBuffer | null = null;
  let crunchLoad: Promise<AudioBuffer | null> | null = null;
  let jetBuf: AudioBuffer | null = null;
  let jetLoad: Promise<AudioBuffer | null> | null = null;
  let shoutBuf: AudioBuffer | null = null;
  let shoutLoad: Promise<AudioBuffer | null> | null = null;

  function ac(): AudioContext {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  }

  function tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
    delay = 0,
    force = false,
  ): void {
    if (muted && !force) return;
    const level = gain * (effectsPercent / EFFECTS_PERCENT);
    if (level <= 0.0008) return;
    const c = ac();
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) {
      o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    }
    g.gain.setValueAtTime(level, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function musicOut(): number {
    return Math.min(1, (musicPercent / MUSIC_PERCENT) * MUSIC_AT_DEFAULT);
  }

  function stampLevels(el: HTMLAudioElement): void {
    el.volume = previewing && previewLoud ? 1 : musicOut();
    el.dataset.musicLevel = String(musicPercent);
    el.dataset.effectsLevel = String(effectsPercent);
  }

  function musicEl(): HTMLAudioElement {
    if (!music) {
      music = new Audio(TRACKS[trackIndex]);
      music.loop = true;
      music.preload = "auto";
      music.dataset.track = String(trackIndex);
      stampLevels(music);
      music.setAttribute("data-music", "1");
      music.hidden = true;
      if (typeof document !== "undefined") document.body.appendChild(music);
      music.addEventListener("ended", () => {
        if (!music || !musicStarted || musicMuted) return;
        music.currentTime = 0;
        void music.play().catch(() => {});
      });
    }
    return music;
  }

  function silenced(): boolean {
    return musicMuted;
  }

  function applyMusic(): void {
    const el = music;
    if (!el || !musicStarted) return;
    if (silenced()) {
      el.pause();
      return;
    }
    void el.play().catch(() => {});
  }

  function trackAt(index: number): number {
    const n = Math.floor(index);
    if (!Number.isFinite(n) || n < 0 || n >= TRACKS.length) return 0;
    return n;
  }

  function loadTrack(index: number, autoplay: boolean): void {
    const el = musicEl();
    const next = trackAt(index);
    trackIndex = next;
    if (el.dataset.track !== String(next)) {
      el.src = TRACKS[next]!;
      el.dataset.track = String(next);
      el.loop = true;
    }
    if (autoplay) applyMusic();
  }

  function loadSample(
    url: string,
    get: () => AudioBuffer | null,
    set: (buf: AudioBuffer) => void,
    pending: () => Promise<AudioBuffer | null> | null,
    setPending: (p: Promise<AudioBuffer | null> | null) => void,
  ): Promise<AudioBuffer | null> {
    const have = get();
    if (have) return Promise.resolve(have);
    const inflight = pending();
    if (inflight) return inflight;
    const job = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.arrayBuffer();
      })
      .then((raw) => ac().decodeAudioData(raw.slice(0)))
      .then((buf) => {
        set(buf);
        return buf;
      })
      .catch(() => null);
    setPending(job);
    return job;
  }

  function playSample(buf: AudioBuffer, gain: number, force = false): void {
    if (muted && !force) return;
    const level = gain * (effectsPercent / EFFECTS_PERCENT);
    if (level <= 0.0008) return;
    const c = ac();
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    const end = now + buf.duration;
    g.gain.setValueAtTime(level, now);
    g.gain.setValueAtTime(level, Math.max(now, end - 0.04));
    g.gain.exponentialRampToValueAtTime(0.001, end);
    src.connect(g);
    g.connect(c.destination);
    src.start(now);
    src.stop(end + 0.02);
  }

  function loadCrunch(): Promise<AudioBuffer | null> {
    return loadSample(
      crunchUrl,
      () => crunchBuf,
      (buf) => {
        crunchBuf = buf;
      },
      () => crunchLoad,
      (p) => {
        crunchLoad = p;
      },
    );
  }

  function loadJet(): Promise<AudioBuffer | null> {
    return loadSample(
      jetUrl,
      () => jetBuf,
      (buf) => {
        jetBuf = buf;
      },
      () => jetLoad,
      (p) => {
        jetLoad = p;
      },
    );
  }

  /** Lettuce bite. The sample is near full scale, so keep it well under that. */
  function crunch(): void {
    if (muted) return;
    if (crunchBuf) playSample(crunchBuf, 0.22);
    else void loadCrunch().then((buf) => buf && playSample(buf, 0.22));
  }

  /** Stage 4 hop. Trimmed fire burst, quieter than the raw sample. */
  function jetJump(): void {
    if (muted) return;
    if (jetBuf) playSample(jetBuf, 0.16);
    else void loadJet().then((buf) => buf && playSample(buf, 0.16));
  }

  function loadShout(): Promise<AudioBuffer | null> {
    return loadSample(
      shoutUrl,
      () => shoutBuf,
      (buf) => {
        shoutBuf = buf;
      },
      () => shoutLoad,
      (p) => {
        shoutLoad = p;
      },
    );
  }

  function shout(): void {
    if (muted) return;
    if (shoutBuf) playSample(shoutBuf, 0.62);
    else void loadShout().then((buf) => buf && playSample(buf, 0.62));
  }

  return {
    unlock() {
      ac();
      void loadCrunch();
      void loadJet();
      void loadShout();
      musicEl();
    },
    setMuted(v: boolean) {
      muted = v;
    },
    setMusicMuted(v: boolean) {
      musicMuted = v;
      applyMusic();
    },
    setTrack(index: number) {
      loadTrack(index, musicStarted);
    },
    setMusicPercent(percent: number) {
      const n = Math.min(100, Math.max(0, Math.round(percent)));
      musicPercent = n;
      if (music) stampLevels(music);
    },
    setEffectsPercent(percent: number) {
      const n = Math.min(100, Math.max(0, Math.round(percent)));
      effectsPercent = n;
      if (music) stampLevels(music);
    },
    previewJump() {
      const el = musicEl();
      el.dataset.fxHeard = String(effectsPercent);
      tone(420, 0.09, "square", 0.045, 700, 0, true);
    },
    previewTrack(index: number, hear = false, loud = true) {
      if (musicStarted) {
        loadTrack(index, true);
        return;
      }
      const el = musicEl();
      const next = trackAt(index);
      trackIndex = next;
      previewing = true;
      previewLoud = loud;
      if (el.dataset.track !== String(next)) {
        el.pause();
        el.src = TRACKS[next]!;
        el.dataset.track = String(next);
        el.loop = true;
      }
      stampLevels(el);
      el.dataset.previewed = "1";
      if (musicMuted && !hear) {
        el.pause();
        return;
      }
      void el.play().catch(() => {});
    },
    stopPreview() {
      if (!previewing || musicStarted) return;
      previewing = false;
      previewLoud = false;
      if (!music) return;
      music.pause();
      music.currentTime = 0;
      stampLevels(music);
    },
    startMusic() {
      previewing = false;
      previewLoud = false;
      musicStarted = true;
      if (music) stampLevels(music);
      loadTrack(trackIndex, true);
    },
    stopMusic() {
      musicStarted = false;
      previewing = false;
      previewLoud = false;
      if (music) music.pause();
    },
    go() {
      tone(320, 0.1, "triangle", 0.05, 520);
    },
    jump() {
      tone(420, 0.09, "square", 0.045, 700);
    },
    jetJump() {
      jetJump();
    },
    land() {
      tone(150, 0.06, "triangle", 0.05);
    },
    die() {
      tone(240, 0.32, "triangle", 0.06, 55);
    },
    gear() {
      tone(520, 0.14, "square", 0.04, 820);
    },
    slide() {
      tone(220, 0.11, "sawtooth", 0.04, 70);
    },
    collect() {
      crunch();
    },
    shout() {
      shout();
    },
    stompRat() {
      tone(740, 0.05, "square", 0.035, 1280);
      tone(1240, 0.07, "square", 0.028, 1760, 0.055);
    },
    stompCoyote() {
      tone(360, 0.15, "triangle", 0.05, 120);
    },
    close() {
      if (music) {
        music.pause();
        music.remove();
        music = null;
      }
      void ctx?.close();
      ctx = null;
    },
  };
}
