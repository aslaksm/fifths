# Fifths

Fifths is a browser-based circle of fifths and practice quiz. Tap either ring to explore a key and its relationships. Practice mixes all four question types by default. You can also select a single type.

In **Intervals**, choose a **Question type** and answer with **Key names** or **Piano** under **Visual**. The piano plays a 1.5-second starting note in the C4–B4 octave. Tap **Play starting note** to hear it again or to start audio if your browser waits for a tap.

Choose **Ear Training** under **Mode** to hear an interval on one continuous keyboard from C3 through C5. The first note is highlighted and plays for 0.5 seconds, followed by a 1.5-second second note. Tap the second note to answer or use **Play interval** to hear it again. On narrow screens, swipe sideways to reach all keys.
After a wrong answer, tap any key to hear it while reviewing the interval. **Continue** starts the next question.

Choose **Chords** to identify the third of a written chord symbol. Use **Key names** or **Piano** for your answer.

The bundled sounds are [Salamander Grand Piano recordings](https://github.com/Tonejs/audio/tree/master/salamander) by Alexander Holm. See [sample credits](public/piano-credits.txt) for attribution and license details.

## Run locally

Use Node.js 22.12 or newer and npm. From this folder, install the development tools once and start Vite.

```sh
npm install
npm run dev
```

Open the Local URL Vite prints, usually [http://localhost:5173](http://localhost:5173). Vite picks up file edits while it runs. Press Ctrl+C to stop it.

## Open on a phone or iPad

Connect your device to the same Wi-Fi network as your Mac. Start Vite with the network option and open the Network URL Vite prints.

```sh
npm run dev -- --host 0.0.0.0
```

If Vite prints multiple Network URLs, use the one with your Mac's Wi-Fi IP. On a Mac with Wi-Fi on `en0`, `ipconfig getifaddr en0` prints that address.

## Build

`npm run typecheck` checks the TypeScript. `npm run build` checks it and generates a static site in `dist/`. Run `npm run preview` to preview that build locally.

Quiz scores are kept for the current page session.
