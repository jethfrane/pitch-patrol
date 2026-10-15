Pitch Patrol began as a personal question: could singing or humming become the control for a playful 3D survival game? The player protects a central guardian by matching the pitch class displayed above approaching musical creatures.

I supplied the concept, musical requirements, art direction, and observations from playtesting. Astra medium helped plan the brief; Argon in Gemini Tasks executed the prototype. Further iteration used Antigravity, and Codex inspected the supplied HTML and modular source for the public release. These names document the workflow I used, not a controlled comparison of model performance.

The main design problem was connecting a detected sound to an intentional action. A momentary pitch crossing or arbitrary keyboard press should not defeat a creature. The release uses a stable-hold matcher, separate piano and microphone input, fresh confirmation windows, and clearer signal feedback. Piano keys produce synthesized sound and reject multiple simultaneous inputs as a single-note answer.

The microphone review found automatic gain enabled in the modular source. The release requests gain control, noise suppression, and echo cancellation off where supported, displays reported input settings, and adds microphone selection, noise calibration, reconnect handling, and pause on interruption. This addresses observable implementation problems without claiming complete control over operating-system or hardware processing.

The game uses a top-down 3D arena, larger note labels, gradual accidentals, health-based enemy attacks, and no-damage practice with a reference tone. Microphone audio is processed in memory on the device and is not recorded or uploaded by the app. The MIT-licensed source is available for inspection and contributions.

Verification combines automated synthetic audio, matching, and health checks with browser layout and interaction checks. Real-world vocal accuracy, physical iOS/Android microphone behavior, long-session performance, and training outcomes are not established. The current microphone mode supports one note at a time; full instrument chord recognition and MIDI are future work.
