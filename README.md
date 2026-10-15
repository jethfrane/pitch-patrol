# Pitch Patrol

**Find your note. Defend the garden.** A small, open-source 3D browser experiment for pitch practice by Jethro Frane.

[Play online](https://pitch-patrol.jethrofrane.xyz/) · [Project & case study](https://jethrofrane.xyz/work/pitch-patrol)

## Play

Choose microphone or on-screen piano, then survival or no-damage practice. In vocal mode, hum or sing the note above a creature and hold it steadily. Any octave of the displayed pitch class is accepted. A confirmed note fires one musical pulse at the most urgent matching creature. You have 100 health in survival.

In piano mode, hold one key for 320 ms. Tap the on-screen keyboard on mobile, or use A W S E D F T G Y H U J K on a computer. Note names and key hints are optional. Multiple simultaneous inputs do not count as a single-note answer. Piano and microphone scoring are isolated.

Practice mode includes a reference tone and disables damage. Listening to a reference tone temporarily suspends microphone scoring. Sound effects are off by default in vocal mode to reduce speaker leakage; piano mode enables sound. Headphones are recommended.

## Microphone setup

Use HTTPS or localhost and allow microphone permission after pressing Start. Open Settings for input selection, a live signal meter, room-noise calibration, sensitivity, pitch tolerance, and diagnostics. Stay quiet during calibration, then test a comfortable hum. Changing sensitivity changes the input gate; it does not change the target tuning. Reference tuning is A4 = 440 Hz.

The game requests automatic gain, noise suppression, and echo cancellation off where supported. Diagnostics report what the browser exposes. Operating-system, Bluetooth, and hardware processing may still affect input. If a device disappears or input is interrupted, the run pauses. Choose an input and reconnect before resuming.

## Scope and limitations

- This is an experimental practice toy, not a validated singing assessment or a substitute for a music teacher or reference tuner.
- Live microphone detection is monophonic: one hummed/sung/instrument note at a time. Full piano/guitar chord recognition and MIDI input are not implemented.
- Synthetic tests cover pitch estimates, noise rejection, hold/rearm timing, and damage behavior. They do not establish accuracy for every voice, room, phone, or browser.
- Desktop Chrome and responsive layouts can be checked in development. Physical iOS/Android microphone behavior still needs device testing. Use an up-to-date browser with WebGL and Web Audio support; embedded social-media browsers may restrict microphone access.
- Targets, speeds, and active enemy counts are bounded, but balancing is ongoing. A sustained unrelated tone from the environment can still match: the game cannot determine intent.
- Best scores are stored locally, separately by input and practice/survival. Different sensitivity/tolerance choices can affect scores; this is not a competitive leaderboard.

## Local development

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Deploy the Vite `dist` output over HTTPS. `vercel.json` configures the build and limits microphone permission to the game origin. No backend or API keys are required.

## Privacy

Microphone samples are analyzed in memory on the device. The app does not record, save, or upload audio and includes no analytics SDK. Preferences/high scores use browser storage. Hosting providers still handle ordinary web requests. The optional Google Fonts stylesheet fetches a font; a system fallback is available. Switch to piano or close the page to stop the microphone.

## AI-assisted workflow

Jethro supplied the concept, direction, playtesting observations, and release scope. The experiment used **Astra medium for planning** and **Argon in Gemini Tasks for prototype execution**, as described by Jethro. Further iteration used Antigravity; Codex inspected the supplied HTML and modular project, improved input handling/gameplay/UI, tested the release, and prepared deployment and documentation. These are workflow credits, not verified model benchmarks or claims of model superiority.

The supplied single-file prototype is preserved in `docs/original-prototype.html`. The running release uses the modular TypeScript source in `src`.

## Contributing

Open an issue with browser/OS, input device type, mode, and steps to reproduce. Do not attach private recordings or credentials. Contributions that improve real-device input reliability, accessibility, and fair practice are welcome.

## License and assets

MIT; see [LICENSE](LICENSE). Original procedural game models, SVG icon, and release graphics are included under the same license. Three.js and other dependencies retain their own licenses. Quicksand is supplied through Google Fonts under the SIL Open Font License; the font files are not bundled here. No reference-game screenshots are used in the game.
