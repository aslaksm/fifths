const noteDuration = 1.5;
const noteRelease = 0.55;

const pianoSamples = [
  { midiNote: 48, url: new URL("./samples/piano/C3.mp3", import.meta.url).href },
  { midiNote: 51, url: new URL("./samples/piano/Ds3.mp3", import.meta.url).href },
  { midiNote: 54, url: new URL("./samples/piano/Fs3.mp3", import.meta.url).href },
  { midiNote: 57, url: new URL("./samples/piano/A3.mp3", import.meta.url).href },
  { midiNote: 60, url: new URL("./samples/piano/C4.mp3", import.meta.url).href },
  { midiNote: 63, url: new URL("./samples/piano/Ds4.mp3", import.meta.url).href },
  { midiNote: 66, url: new URL("./samples/piano/Fs4.mp3", import.meta.url).href },
  { midiNote: 69, url: new URL("./samples/piano/A4.mp3", import.meta.url).href },
  { midiNote: 72, url: new URL("./samples/piano/C5.mp3", import.meta.url).href },
];

type PianoSample = typeof pianoSamples[number];
type PianoNote = { midiNote: number; duration: number };

const sampleBytes = new Map<number, Promise<ArrayBuffer>>();
let decodedSamples = new Map<number, Promise<AudioBuffer>>();

let audioContext: AudioContext | undefined;
let playbackId = 0;
const activeNotes = new Set<AudioBufferSourceNode>();

function fetchSample({ midiNote, url }: PianoSample): Promise<ArrayBuffer> {
  const cached = sampleBytes.get(midiNote);
  if (cached) return cached;
  const pending = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`Unable to load piano sample ${midiNote}`);
    return response.arrayBuffer();
  }).catch((error: unknown) => {
    sampleBytes.delete(midiNote);
    throw error;
  });
  sampleBytes.set(midiNote, pending);
  return pending;
}

export function preloadPianoSamples(includeLowerOctave = false): void {
  if (typeof AudioContext === "undefined") return;
  const samples = includeLowerOctave ? pianoSamples : pianoSamples.filter(({ midiNote }) => midiNote >= 60);
  void Promise.allSettled(samples.map(fetchSample));
}

function decodeSample(context: AudioContext, sample: PianoSample): Promise<AudioBuffer> {
  const cache = decodedSamples;
  const cached = cache.get(sample.midiNote);
  if (cached) return cached;
  // The decoder takes ownership of its input, so preserve the cached bytes.
  const sampleData = fetchSample(sample);
  const pending = sampleData.then((bytes) => context.decodeAudioData(bytes.slice(0)))
    .catch((error: unknown) => {
      cache.delete(sample.midiNote);
      if (sampleBytes.get(sample.midiNote) === sampleData) sampleBytes.delete(sample.midiNote);
      throw error;
    });
  cache.set(sample.midiNote, pending);
  return pending;
}

export function stopPianoAudio(): void {
  playbackId++;
  for (const note of activeNotes) note.stop();
  activeNotes.clear();
}

function scheduleNote(context: AudioContext, buffer: AudioBuffer, rate: number, startTime: number, duration: number): void {
  const voice = context.createBufferSource();
  const envelope = context.createGain();
  const endTime = startTime + duration;
  const releaseTime = duration * noteRelease / noteDuration;
  voice.buffer = buffer;
  voice.playbackRate.value = rate;
  voice.connect(envelope);
  envelope.connect(context.destination);
  envelope.gain.setValueAtTime(0.75, startTime);
  envelope.gain.setValueAtTime(0.75, endTime - releaseTime);
  envelope.gain.exponentialRampToValueAtTime(0.001, endTime);

  voice.addEventListener("ended", () => {
    activeNotes.delete(voice);
    voice.disconnect();
    envelope.disconnect();
  }, { once: true });
  voice.start(startTime);
  voice.stop(endTime);
  activeNotes.add(voice);
}

function playPianoNotes(notes: readonly PianoNote[]): void {
  stopPianoAudio();
  if (typeof AudioContext === "undefined") return;

  const request = playbackId;
  try {
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContext();
      decodedSamples = new Map();
    }
    const context = audioContext;
    // Resume directly in the gesture handler, before waiting for the recordings.
    const resume = context.state === "running" ? Promise.resolve() : context.resume();
    const recordings = notes.map(async ({ midiNote, duration }) => {
      const sample = pianoSamples.reduce((nearest, candidate) =>
        Math.abs(candidate.midiNote - midiNote) < Math.abs(nearest.midiNote - midiNote)
          ? candidate
          : nearest);
      const rate = 2 ** ((midiNote - sample.midiNote) / 12);
      return { buffer: await decodeSample(context, sample), rate, duration };
    });
    void Promise.all([resume, Promise.all(recordings)]).then(([, loaded]) => {
      if (request !== playbackId || context.state !== "running") return;
      let startTime = context.currentTime;
      for (const { buffer, rate, duration } of loaded) {
        scheduleNote(context, buffer, rate, startTime, duration);
        startTime += duration;
      }
    }).catch(() => {
      // The next gesture can retry loading samples or resuming blocked audio.
    });
  } catch {
    // The quiz can continue if audio is unavailable on this device.
  }
}

export function playMidiNote(midiNote: number): void {
  playPianoNotes([{ midiNote, duration: noteDuration }]);
}

export function playPianoInterval(firstMidi: number, secondMidi: number): void {
  playPianoNotes([
    { midiNote: firstMidi, duration: 0.5 },
    { midiNote: secondMidi, duration: noteDuration },
  ]);
}
