const crunchUrl = new URL("./crunch.wav", import.meta.url).href;
const jetUrl = new URL("./jet-jump.wav", import.meta.url).href;

export function createSfx() {
  let ctx: AudioContext | null = null;
  let muted = false;
  let crunchBuf: AudioBuffer | null = null;
  let crunchLoad: Promise<AudioBuffer | null> | null = null;
  let jetBuf: AudioBuffer | null = null;
  let jetLoad: Promise<AudioBuffer | null> | null = null;

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
  ): void {
    if (muted) return;
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) {
      o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), c.currentTime + dur);
    }
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
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

  function playSample(buf: AudioBuffer, gain: number): void {
    if (muted) return;
    const c = ac();
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    const end = now + buf.duration;
    g.gain.setValueAtTime(gain, now);
    g.gain.setValueAtTime(gain, Math.max(now, end - 0.04));
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

  return {
    unlock() {
      ac();
      void loadCrunch();
      void loadJet();
    },
    setMuted(v: boolean) {
      muted = v;
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
    collect() {
      crunch();
    },
    close() {
      void ctx?.close();
      ctx = null;
    },
  };
}
