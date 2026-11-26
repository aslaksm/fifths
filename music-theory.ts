export type Mode = "major" | "minor";
export type QuizTypeId = "up" | "down" | "relative" | "up-relative";

export interface Key {
  readonly major: string;
  readonly minor: string;
  readonly sharps: number;
  readonly flats: number;
  readonly alternate?: Key;
}

export interface Question {
  index: number;
  type: QuizTypeId;
  mode: Mode;
  answer: number;
  options: number[];
}

interface QuestionType {
  id: QuizTypeId;
  label: string;
  description: string;
  mode: Mode;
  answerOffset: number;
}

function key(major: string, minor: string, signature: number, alternate?: Key): Key {
  // Positive signatures count sharps. Negative signatures count flats.
  return Object.freeze({
    major,
    minor,
    sharps: Math.max(signature, 0),
    flats: Math.max(-signature, 0),
    ...(alternate && { alternate }),
  });
}

export const keys = Object.freeze([
  key("C", "Am", 0),
  key("G", "Em", 1),
  key("D", "Bm", 2),
  key("A", "F♯m", 3),
  key("E", "C♯m", 4),
  key("B", "G♯m", 5),
  key("F♯", "D♯m", 6, key("G♭", "E♭m", -6)),
  key("D♭", "B♭m", -5, key("C♯", "A♯m", 7)),
  key("A♭", "Fm", -4),
  key("E♭", "Cm", -3),
  key("B♭", "Gm", -2),
  key("F", "Dm", -1),
]);

const questionTypes: QuestionType[] = [
  {
    id: "up",
    label: "Up a fifth",
    description: "Move one step clockwise on the circle.",
    mode: "major",
    answerOffset: 1,
  },
  {
    id: "down",
    label: "Down a fifth",
    description: "Move one step counterclockwise on the circle.",
    mode: "major",
    answerOffset: -1,
  },
  {
    id: "relative",
    label: "Relative minor",
    description: "Find the minor key with the same key signature.",
    mode: "minor",
    answerOffset: 0,
  },
  {
    id: "up-relative",
    label: "Up, then relative minor",
    description: "Move one step clockwise, then find that key’s relative minor.",
    mode: "minor",
    answerOffset: 1,
  },
];

export const quizTypes = Object.freeze(
  questionTypes.map(({ id, label, description }) => Object.freeze({ id, label, description })),
);

function definition(type: QuizTypeId): QuestionType {
  const match = questionTypes.find(({ id }) => id === type);
  if (!match) throw new RangeError(`Unknown quiz type: ${type}`);
  return match;
}

function wrap(index: number): number {
  return ((index % keys.length) + keys.length) % keys.length;
}

export function getAnswer(index: number, type: QuizTypeId): number {
  return wrap(index + definition(type).answerOffset);
}

export function pitchClassForKey(index: number, mode: Mode): number {
  // Each clockwise fifth adds seven semitones. A relative minor is nine above its major tonic within an octave.
  return wrap(index * 7 + (mode === "minor" ? 9 : 0));
}

export function makeQuestion(index: number, type: QuizTypeId): Question {
  const { mode, answerOffset } = definition(type);

  return {
    index: wrap(index),
    type,
    mode,
    answer: wrap(index + answerOffset),
    options: keys.map((_, keyIndex) => keyIndex),
  };
}
