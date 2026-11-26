import { keys, pitchClassForKey } from "./music-theory.ts";

export interface ChordQuestion {
  readonly symbol: string;
  readonly root: number;
  readonly answer: number;
  readonly third: string;
  readonly semitones: 3 | 4;
  readonly options: readonly string[];
}

const chromaticNotes = keys
  .map(({ major }, index) => ({ name: major, pitch: pitchClassForKey(index, "major") }))
  .sort((a, b) => a.pitch - b.pitch)
  .map(({ name }) => name);

const chordQualities = [
  { suffix: "", semitones: 4 },
  { suffix: "m", semitones: 3 },
  { suffix: "maj7", semitones: 4 },
  { suffix: "7", semitones: 4 },
  { suffix: "m7", semitones: 3 },
] as const;

function spellThird(rootName: string, pitch: number): string {
  const letters = "CDEFGAB";
  const thirdLetter = letters[(letters.indexOf(rootName[0]) + 2) % letters.length];
  const naturalPitch = chromaticNotes.indexOf(thirdLetter);
  const octave = chromaticNotes.length;
  const halfOctave = octave / 2;
  // Find the closest spelling of this pitch using the third's letter.
  const accidental = (pitch - naturalPitch + octave + halfOctave) % octave - halfOctave;
  const symbol = accidental > 0 ? "♯" : "♭";
  return thirdLetter + symbol.repeat(Math.abs(accidental));
}

const questions: ChordQuestion[] = chromaticNotes.flatMap((rootName, root) =>
  chordQualities.map(({ suffix, semitones }) => {
    const answer = (root + semitones) % chromaticNotes.length;
    const third = spellThird(rootName, answer);
    return {
      symbol: rootName + suffix,
      root,
      answer,
      third,
      semitones,
      options: chromaticNotes.map((name, pitch) => pitch === answer ? third : name),
    };
  }),
);

export function makeChordQuestion(previous?: ChordQuestion): ChordQuestion {
  const available = questions.filter(({ symbol }) => symbol !== previous?.symbol);
  return available[Math.floor(Math.random() * available.length)];
}
