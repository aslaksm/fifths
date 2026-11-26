import {
  getAnswer, keys, makeQuestion, pitchClassForKey, quizTypes,
  type Key, type Mode, type Question, type QuizTypeId,
} from "./music-theory.ts";
import { makeChordQuestion, type ChordQuestion } from "./chord-questions.ts";
import { playMidiNote, playPianoInterval, preloadPianoSamples, stopPianoAudio } from "./piano-audio.ts";

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}

function selectElement(id: string): HTMLSelectElement {
  const element = byId(id);
  if (!(element instanceof HTMLSelectElement)) throw new Error(`Expected a select at #${id}`);
  return element;
}

const wheel = byId("wheel");
const relationships = byId("relationships");
const quizType = selectElement("quiz-type");
const quizVisual = selectElement("quiz-format");
const quizMode = selectElement("quiz-mode");
const questionPanel = byId("question-panel");
const answerOptions = byId("answer-options");
const pianoPanel = byId("piano-panel");
const pianoKeyboard = byId("piano-keyboard");
const prompt = byId("prompt");
const promptKey = byId("prompt-key");
const promptNotation = byId("prompt-notation");
const reviewPanel = byId("review-panel");
const reviewWheel = byId("review-wheel");
const reviewTitle = byId("review-title");
const earPanel = byId("ear-panel");
const earPrompt = byId("ear-prompt");
const earInstruction = byId("ear-instruction");
const earReview = byId("ear-review");
const earKeyboardScroll = byId("ear-keyboard-scroll");
const chordPanel = byId("chord-panel");
const chordPrompt = byId("chord-prompt");
const chordOptions = byId("chord-options");
const chordKeyboard = byId("chord-keyboard");
const chordReview = byId("chord-review");

type KeySelection = { index: number; mode: Mode };
type EarQuestion = { first: number; second: number };

let selectedKey: KeySelection = { index: 0, mode: "major" };
let question: Question | undefined;
let earQuestion: EarQuestion | undefined;
let chordQuestion: ChordQuestion | undefined;
let selectedVisual = quizVisual.value;
const theoryScore = { correct: 0, total: 0 };
const earScore = { correct: 0, total: 0 };
const chordScore = { correct: 0, total: 0 };
let remainingTypes: QuizTypeId[] = [];

function noteName(key: Key, mode: Mode): string {
  return mode === "minor" ? key.minor.slice(0, -1) : key.major;
}

function fullName(key: Key, mode: Mode): string {
  return `${noteName(key, mode)} ${mode}`;
}

function signatureName({ sharps, flats }: Key): string {
  const count = sharps || flats;
  if (!count) return "No sharps or flats";
  const accidental = sharps ? "sharp" : "flat";
  return `${count} ${accidental}${count === 1 ? "" : "s"}`;
}

function point(radius: number, angle: number): [string, string] {
  const radians = angle * Math.PI / 180;
  return [
    (50 + radius * Math.sin(radians)).toFixed(3) + "%",
    (50 - radius * Math.cos(radians)).toFixed(3) + "%",
  ];
}

function sector(index: number, outer: number, inner: number): string {
  const center = index * 30;
  const points = [];
  for (let step = 0; step <= 12; step++) {
    points.push(point(outer, center - 14.75 + step * 29.5 / 12).join(" "));
  }
  for (let step = 12; step >= 0; step--) {
    points.push(point(inner, center - 14.65 + step * 29.3 / 12).join(" "));
  }
  return `polygon(${points.join(", ")})`;
}

function makeWheel(container: HTMLElement, onSelect?: (index: number, mode: Mode) => void) {
  const wedges: Record<Mode, HTMLElement[]> = { major: [], minor: [] };
  for (const mode of ["major", "minor"] as const) {
    const [outer, inner] = mode === "major" ? [50, 36] : [35.55, 20.7];
    keys.forEach((key, index) => {
      const wedge = document.createElement(onSelect ? "button" : "div");
      const label = document.createElement("span");
      const [x, y] = point((outer + inner) / 2, index * 30);
      wedge.className = `sector sector-${mode}`;
      wedge.dataset.index = String(index);
      wedge.dataset.mode = mode;
      wedge.dataset.accidentals = key.sharps ? "sharps" : key.flats ? "flats" : "natural";
      wedge.style.setProperty("--sector", sector(index, outer, inner));
      wedge.style.setProperty("--x", x);
      wedge.style.setProperty("--y", y);
      if (onSelect && wedge instanceof HTMLButtonElement) {
        wedge.type = "button";
        wedge.addEventListener("click", () => onSelect(index, mode));
        wedge.setAttribute("aria-label", fullName(key, mode));
      }
      label.textContent = key[mode];
      wedge.append(label);
      container.append(wedge);
      wedges[mode].push(wedge);
    });
  }
  return wedges;
}

const wheelButtons = makeWheel(wheel, selectKey);
const reviewWedges = makeWheel(reviewWheel);

const relationshipDefinitions = [
  { icon: "↷", label: "Up a fifth", type: "up" },
  { icon: "↶", label: "Down a fifth", type: "down" },
  { icon: "↔", label: "Relative minor", type: "relative" },
  { icon: "↗", label: "Up, then relative minor", type: "up-relative" },
] satisfies { icon: string; label: string; type: QuizTypeId }[];

function getRelationship(index: number, mode: Mode, type: QuizTypeId): KeySelection {
  const target = getAnswer(index, type);
  const relative = type === "relative";
  const targetMode = type === "up-relative" || (relative && mode === "major")
    ? "minor"
    : relative ? "major" : mode;
  return { index: target, mode: targetMode };
}

const relationshipButtons = relationshipDefinitions.map(({ icon, type }) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "relationship";
  const symbol = document.createElement("span");
  symbol.className = "relationship-icon";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = icon;
  const label = document.createElement("span");
  label.className = "relationship-label";
  const note = document.createElement("span");
  note.className = "relationship-note";
  button.append(symbol, label, note);
  button.addEventListener("click", () => {
    const target = getRelationship(selectedKey.index, selectedKey.mode, type);
    selectKey(target.index, target.mode);
    if (button.hidden) wheelButtons[selectedKey.mode][selectedKey.index].focus();
  });
  relationships.append(button);
  return { button, label, note };
});

function selectKey(index: number, mode: Mode) {
  selectedKey = { index, mode };
  const key = keys[index];
  byId("wheel-note").textContent = noteName(key, mode);
  byId("wheel-mode").textContent = mode;
  byId("key-title").textContent = fullName(key, mode);
  byId("signature").textContent = signatureName(key);
  const alternate = byId("enharmonic");
  alternate.hidden = !key.alternate;
  alternate.textContent = key.alternate
    ? `Also spelled ${fullName(key.alternate, mode)} (${signatureName(key.alternate).toLowerCase()}).`
    : "";

  for (const ring of ["major", "minor"] as const) {
    wheelButtons[ring].forEach((button, slot) => {
      const active = ring === mode && slot === index;
      button.tabIndex = active ? 0 : -1;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("paired", slot === index && ring !== mode);
    });
  }

  relationshipDefinitions.forEach(({ label: name, type }, position) => {
    const { button, label, note } = relationshipButtons[position];
    const target = getRelationship(index, mode, type);
    label.textContent = type === "relative" && mode === "minor" ? "Relative major" : name;
    note.textContent = keys[target.index][target.mode];
    button.hidden = mode === "minor" && type === "up-relative";
    button.setAttribute("aria-label", `${label.textContent}, ${fullName(keys[target.index], target.mode)}`);
  });
}

wheel.addEventListener("keydown", (event) => {
  let { index, mode } = selectedKey;
  switch (event.key) {
    case "ArrowRight": index = getAnswer(index, "up"); break;
    case "ArrowLeft": index = getAnswer(index, "down"); break;
    case "ArrowUp": mode = "major"; break;
    case "ArrowDown": mode = "minor"; break;
    case "Home": index = 0; break;
    default: return;
  }
  event.preventDefault();
  selectKey(index, mode);
  wheelButtons[mode][index].focus();
});

const questionNotation: Record<QuizTypeId, string> = {
  up: "V = ?",
  down: "IV = ?",
  relative: "vi = ?",
  "up-relative": "vi of V = ?",
};

const MIDDLE_C_MIDI = 60;
const C3_MIDI = 48;
const C5_MIDI = 72;
const WHITE_KEYS_PER_OCTAVE = 7;

const pianoNotes = [
  { name: "C", label: "C", position: 0, black: false },
  { name: "C♯", label: "C sharp or D flat", position: 1, black: true },
  { name: "D", label: "D", position: 1, black: false },
  { name: "D♯", label: "D sharp or E flat", position: 2, black: true },
  { name: "E", label: "E", position: 2, black: false },
  { name: "F", label: "F", position: 3, black: false },
  { name: "F♯", label: "F sharp or G flat", position: 4, black: true },
  { name: "G", label: "G", position: 4, black: false },
  { name: "G♯", label: "G sharp or A flat", position: 5, black: true },
  { name: "A", label: "A", position: 5, black: false },
  { name: "A♯", label: "A sharp or B flat", position: 6, black: true },
  { name: "B", label: "B", position: 6, black: false },
];

function makePianoKeyboard(
  container: HTMLElement,
  firstC: number,
  lastNote: number,
  onSelect: (midiNote: number) => void,
  labelOctaves = false,
) {
  const layout = Array.from({ length: lastNote - firstC + 1 }, (_, offset) => {
    const note = pianoNotes[offset % pianoNotes.length];
    const position = Math.floor(offset / pianoNotes.length) * WHITE_KEYS_PER_OCTAVE + note.position;
    return { note, position, midiNote: firstC + offset };
  });
  const whiteKeys = layout.filter(({ note }) => !note.black).length;
  container.style.setProperty("--piano-white-keys", String(whiteKeys));
  return layout.map(({ note, position, midiNote }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = note.black ? "piano-key piano-black" : "piano-key piano-white";
    button.style.setProperty("--key-position", `${position / whiteKeys * 100}%`);
    if (labelOctaves && note.name === "C") {
      const marker = document.createElement("span");
      marker.className = "piano-octave-marker";
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = noteWithOctave(midiNote);
      button.append(marker);
    }
    button.addEventListener("click", () => onSelect(midiNote));
    container.append(button);
    const label = labelOctaves ? `${note.label}, octave ${octaveFor(midiNote)}` : note.label;
    return { button, midiNote, label };
  });
}

type PianoKey = ReturnType<typeof makePianoKeyboard>[number];

function markPianoKeys(pianoKeys: readonly PianoKey[], first: number, answer?: number) {
  for (const { button, midiNote, label } of pianoKeys) {
    const starting = midiNote === first;
    const correct = midiNote === answer;
    button.classList.toggle("is-starting", starting);
    button.classList.toggle("is-answer", correct);
    const role = starting ? ", starting note" : correct ? ", correct answer" : "";
    button.setAttribute("aria-label", label + role);
  }
}

const pianoButtons = makePianoKeyboard(pianoKeyboard, MIDDLE_C_MIDI, C5_MIDI - 1, (midiNote) => {
  if (!question || pianoPanel.hidden) return;
  const { mode, options } = question;
  const choice = options.find((option) => pitchClassForKey(option, mode) === midiNote - MIDDLE_C_MIDI);
  if (choice !== undefined) submitAnswer(choice);
});

const earKeys = makePianoKeyboard(byId("ear-keyboard"), C3_MIDI, C5_MIDI, pressEarKey, true);
const earNotes = earKeys.map(({ midiNote }) => midiNote);
const chordKeys = makePianoKeyboard(chordKeyboard, MIDDLE_C_MIDI, C5_MIDI - 1, (midiNote) => {
  submitChordAnswer(midiNote - MIDDLE_C_MIDI);
});

function octaveFor(midiNote: number): number {
  return Math.floor(midiNote / pianoNotes.length) - 1;
}

function noteWithOctave(midiNote: number): string {
  return `${pianoNotes[midiNote % pianoNotes.length].name}${octaveFor(midiNote)}`;
}

function revealHighlightedEarKey() {
  if (!earQuestion || !earKeyboardScroll.clientWidth) return;
  const midiNote = earReview.hidden ? earQuestion.first : earQuestion.second;
  const key = earKeys[midiNote - C3_MIDI].button.getBoundingClientRect();
  const viewport = earKeyboardScroll.getBoundingClientRect();
  if (key.left < viewport.left || key.right > viewport.right) {
    earKeyboardScroll.scrollLeft += key.left - viewport.left - (viewport.width - key.width) / 2;
  }
}

new ResizeObserver(revealHighlightedEarKey).observe(earKeyboardScroll);

function updateScore() {
  const score = quizMode.value === "ear" ? earScore
    : quizMode.value === "chords" ? chordScore : theoryScore;
  byId("score").textContent = `${score.correct} / ${score.total} correct`;
}

function lockPracticeControls(locked: boolean) {
  quizMode.disabled = locked;
  quizType.disabled = locked;
  quizVisual.disabled = locked || quizMode.value === "ear";
}

function updatePracticeControls() {
  const intervals = quizMode.value === "intervals";
  const ear = quizMode.value === "ear";
  const piano = selectedVisual === "piano";
  quizVisual.value = ear ? "piano" : selectedVisual;
  quizVisual.disabled = ear || quizMode.disabled;
  byId("quiz-type-filter").hidden = !intervals;
  byId("practice-intro").textContent = ear
    ? "Identify the second note of an interval by ear."
    : intervals ? "Find neighboring keys and their relative minors."
    : "Identify the third of a chord from its symbol.";
  questionPanel.hidden = !intervals || !reviewPanel.hidden;
  earPanel.hidden = !ear;
  chordPanel.hidden = intervals || ear;
  pianoPanel.hidden = !piano;
  promptKey.hidden = piano;
  answerOptions.hidden = piano;
  chordOptions.hidden = piano;
  chordKeyboard.hidden = !piano;
  if (piano && question) {
    prompt.setAttribute("aria-label", `${fullName(keys[question.index], "major")}. ${questionNotation[question.type]}`);
  } else {
    prompt.removeAttribute("aria-label");
  }
}

function playStartingNote() {
  if (!question || pianoPanel.hidden || questionPanel.hidden) return;
  const note = MIDDLE_C_MIDI + pitchClassForKey(question.index, "major");
  playMidiNote(note);
}

function playEarQuestion() {
  if (earQuestion && !earPanel.hidden) playPianoInterval(earQuestion.first, earQuestion.second);
}

function askEarQuestion({ moveFocus = false } = {}) {
  const firstNotes = earNotes.filter((note) => note !== earQuestion?.first);
  const first = firstNotes[Math.floor(Math.random() * firstNotes.length)];
  const secondNotes = earNotes.filter((note) => note !== first && Math.abs(note - first) <= pianoNotes.length);
  const second = secondNotes[Math.floor(Math.random() * secondNotes.length)];
  earQuestion = { first, second };
  earPanel.classList.remove("is-review");
  earReview.hidden = true;
  earPrompt.textContent = "Find the second note";
  earPrompt.setAttribute("aria-label", `Find the second note. Starting note ${noteWithOctave(first)}.`);
  byId("ear-question-number").textContent = `Question ${earScore.total + 1}`;
  earInstruction.textContent = "Listen to both notes. The first note is highlighted.";
  markPianoKeys(earKeys, first);
  revealHighlightedEarKey();
  playEarQuestion();
  if (moveFocus) earPrompt.focus();
}

function pressEarKey(midiNote: number) {
  if (!earQuestion || earPanel.hidden) return;
  if (!earReview.hidden) {
    playMidiNote(midiNote);
    return;
  }
  const { first, second } = earQuestion;
  earScore.total++;
  if (midiNote === second) {
    earScore.correct++;
    updateScore();
    askEarQuestion({ moveFocus: true });
    return;
  }

  updateScore();
  stopPianoAudio();
  lockPracticeControls(true);
  earPanel.classList.add("is-review");
  earReview.hidden = false;
  const answer = noteWithOctave(second);
  byId("ear-question-number").textContent = "Correct answer";
  earPrompt.textContent = answer;
  earPrompt.setAttribute("aria-label", `The correct answer is ${answer}`);
  earInstruction.textContent = `You chose ${noteWithOctave(midiNote)}. The interval goes from ${noteWithOctave(first)} to ${answer}. Tap any key to hear it.`;
  markPianoKeys(earKeys, first, second);
  revealHighlightedEarKey();
  earPrompt.focus();
}

function makeAnswerButton(index: number, label: string, accessibleLabel = label): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "answer";
  button.dataset.index = String(index);
  button.textContent = label;
  button.setAttribute("aria-label", accessibleLabel);
  return button;
}

function askChordQuestion({ moveFocus = false } = {}) {
  chordQuestion = makeChordQuestion(chordQuestion);
  const { symbol, root, options } = chordQuestion;
  byId("chord-symbol").textContent = symbol;
  byId("chord-number").textContent = `Question ${chordScore.total + 1}`;
  chordReview.hidden = true;
  chordOptions.replaceChildren(...options.map((label, pitch) => {
    const button = makeAnswerButton(pitch, label);
    button.addEventListener("click", () => submitChordAnswer(pitch));
    return button;
  }));
  markPianoKeys(chordKeys, MIDDLE_C_MIDI + root);
  for (const { button } of chordKeys) button.disabled = false;
  if (moveFocus) chordPrompt.focus();
}

function submitChordAnswer(pitch: number) {
  if (!chordQuestion || chordPanel.hidden || !chordReview.hidden) return;
  const { root, answer, third, options, semitones } = chordQuestion;
  const correct = pitch === answer;
  chordScore.total++;
  if (correct) chordScore.correct++;
  updateScore();
  if (correct) {
    askChordQuestion({ moveFocus: true });
    return;
  }

  const thirdKind = semitones === 4 ? "major third" : "minor third";
  byId("chord-feedback").textContent =
    `You chose ${options[pitch]}. The third is ${third}. A ${thirdKind} is ${semitones} semitones above the root.`;
  for (const button of chordOptions.querySelectorAll("button")) {
    button.classList.toggle("is-answer", Number(button.dataset.index) === answer);
    button.disabled = true;
  }
  markPianoKeys(chordKeys, MIDDLE_C_MIDI + root, MIDDLE_C_MIDI + answer);
  for (const { button } of chordKeys) button.disabled = true;
  lockPracticeControls(true);
  chordReview.hidden = false;
  byId("chord-continue").focus();
}

for (const type of quizTypes) {
  quizType.add(new Option(type.label, type.id));
}

function chooseType(): QuizTypeId {
  const selected = quizTypes.find((type) => type.id === quizType.value);
  if (selected) return selected.id;
  if (!remainingTypes.length) remainingTypes = quizTypes.map(({ id }) => id);
  const choices = remainingTypes.length > 1
    ? remainingTypes.filter((type) => type !== question?.type)
    : remainingTypes;
  const type = choices[Math.floor(Math.random() * choices.length)];
  remainingTypes = remainingTypes.filter((remaining) => remaining !== type);
  return type;
}

function askQuestion({ moveFocus = false } = {}) {
  const type = chooseType();
  const available = keys.map((_, index) => index).filter((index) => index !== question?.index);
  const index = available[Math.floor(Math.random() * available.length)];
  question = makeQuestion(index, type);
  const { mode, options } = question;
  promptKey.textContent = fullName(keys[index], "major");
  promptNotation.textContent = questionNotation[type];
  byId("question-number").textContent = `Question ${theoryScore.total + 1}`;
  answerOptions.replaceChildren(...options.map((option) =>
    makeAnswerButton(option, keys[option][mode], fullName(keys[option], mode))));
  markPianoKeys(pianoButtons, MIDDLE_C_MIDI + pitchClassForKey(index, "major"));
  updatePracticeControls();
  playStartingNote();
  if (moveFocus) prompt.focus();
}

function explainAnswer({ index, type, mode, answer }: Question): string {
  const start = fullName(keys[index], "major");
  const correct = fullName(keys[answer], mode);
  switch (type) {
    case "up": return `Move one step clockwise from ${start} to ${correct}.`;
    case "down": return `Move one step counterclockwise from ${start} to ${correct}.`;
    case "relative": return `${start} and ${correct} share a key signature.`;
    case "up-relative": return `From ${start}, move clockwise to ${fullName(keys[answer], "major")}, then inward to ${correct}.`;
  }
}

function showReview(missedQuestion: Question, choice: number) {
  const { index, type, mode, answer } = missedQuestion;
  const correct = fullName(keys[answer], mode);
  const explanation = explainAnswer(missedQuestion);
  const step = type === "up-relative" ? answer : undefined;

  reviewTitle.textContent = correct;
  reviewTitle.setAttribute("aria-label", `The correct answer is ${correct}`);
  byId("review-choice").textContent = `You chose ${fullName(keys[choice], mode)}.`;
  byId("review-explanation").textContent = explanation;
  byId("review-wheel-note").textContent = noteName(keys[answer], mode);
  byId("review-wheel-mode").textContent = mode;
  byId("review-step-legend").hidden = step === undefined;
  reviewWheel.setAttribute("aria-label", `Circle of fifths. ${explanation}`);
  for (const ring of ["major", "minor"] as const) {
    reviewWedges[ring].forEach((wedge, slot) => {
      wedge.classList.toggle("review-origin", ring === "major" && slot === index);
      wedge.classList.toggle("review-step", ring === "major" && slot === step);
      wedge.classList.toggle("review-answer", ring === mode && slot === answer);
    });
  }

  questionPanel.hidden = true;
  lockPracticeControls(true);
  reviewPanel.hidden = false;
  reviewTitle.focus();
}

function submitAnswer(choice: number) {
  if (!question || !reviewPanel.hidden) return;
  const correct = choice === question.answer;
  theoryScore.total++;
  if (correct) theoryScore.correct++;
  updateScore();
  if (correct) {
    askQuestion({ moveFocus: true });
  } else {
    stopPianoAudio();
    showReview(question, choice);
  }
}

answerOptions.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("button.answer") : null;
  if (button instanceof HTMLButtonElement && !answerOptions.hidden) {
    submitAnswer(Number(button.dataset.index));
  }
});

byId("review-continue").addEventListener("click", () => {
  reviewPanel.hidden = true;
  questionPanel.hidden = false;
  lockPracticeControls(false);
  askQuestion({ moveFocus: true });
});

quizType.addEventListener("change", () => {
  remainingTypes = [];
  askQuestion();
});

function showPractice() {
  updatePracticeControls();
  updateScore();
  if (quizMode.value === "ear") {
    preloadPianoSamples(true);
    if (!earQuestion) askEarQuestion();
    else {
      revealHighlightedEarKey();
      if (earReview.hidden) playEarQuestion();
    }
  } else if (quizMode.value === "chords") {
    stopPianoAudio();
    if (!chordQuestion) askChordQuestion();
  } else {
    preloadPianoSamples();
    if (!question) askQuestion();
    else if (!pianoPanel.hidden) playStartingNote();
    else stopPianoAudio();
  }
}

quizMode.addEventListener("change", showPractice);
quizVisual.addEventListener("change", () => {
  selectedVisual = quizVisual.value;
  showPractice();
});
byId("ear-continue").addEventListener("click", () => {
  lockPracticeControls(false);
  askEarQuestion({ moveFocus: true });
});
byId("chord-continue").addEventListener("click", () => {
  lockPracticeControls(false);
  askChordQuestion({ moveFocus: true });
});
byId("play-interval").addEventListener("click", playEarQuestion);
byId("play-starting-note").addEventListener("click", () => playStartingNote());

function showView(moveFocus = false) {
  const name = location.hash === "#practice" ? "practice" : "explore";
  const practice = name === "practice";
  byId("explore-view").hidden = practice;
  byId("practice-view").hidden = !practice;
  for (const link of document.querySelectorAll<HTMLAnchorElement>(".view-nav a")) {
    if (link.dataset.view === name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (practice) showPractice();
  else stopPianoAudio();
  if (moveFocus) byId(`${name}-view`).querySelector("h1")?.focus();
}

selectKey(0, "major");
showView();
window.addEventListener("hashchange", () => showView(true));
