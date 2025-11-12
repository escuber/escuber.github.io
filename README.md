
# KeyCatcher

**One phone or PC to type on any computer, even when copy and paste is blocked.**

KeyCatcher turns a small ESP32 board into a universal keyboard bridge. It receives text and commands over BLE or UDP, then outputs them as USB HID or BLE HID keystrokes. No drivers. Plug it in and type.

## Why it exists

* Copy and paste is often disabled in secure apps and VDI sessions.
* People need to move text and commands between devices without cloud sync.
* Accessibility and speed both improve when you can send clean keystrokes on demand.

## What it is

* **KeyCatcher Server (ESP32):** Firmware that listens over BLE and UDP and emits keystrokes as a standard HID keyboard over USB or BLE.
* **KeyCatcher Client (Windows and Android):** A simple app to connect, configure, and send text or macros to one or more servers.

## Core requirements

### Server (ESP32)

* Accept input over BLE and UDP.
* Output as USB HID keyboard or BLE HID keyboard.
* Chunked transport with ack, retry, and auto reconnect for reliable delivery.
* Optional legacy mode for straight unframed data.
* No drivers required on host machines.

**Nice to have**

* Built-in AP and web UI for setup, docs, and on-device macro configuration.

### Client (Windows and Android)

* Unified UI and identical features on both platforms.
* Create and send messages and macros to any server.
* Full BLE and UDP protocol support, including large messages up to about 6 KB (roughly 22 pages of text).
* Auto select the best transport (BLE or UDP) and fall back on failure.
* Configure server network settings and device identity.
* Picture to text helper for quick OCR into keystrokes.

## How it works

1. Client splits text into chunks, adds sequence and checksum.
2. Server acks each chunk, requests retry on loss, and reassembles payload.
3. Server renders payload as keystrokes over HID with selectable layout and pacing.
4. Client monitors progress and retries as needed. If link conditions change, it switches transport.

## Reliability and performance

* Chunked frames with ack and retry.
* Auto reconnect on link loss.
* Flow control and pacing to avoid HID buffer overflow.
* Target: full 6 KB payload typed without visible glitches on typical hosts.

## Security

* Pairing and allow-list for BLE connections.
* Optional pre-shared key for UDP sessions on trusted LANs.
* Local only by default. No cloud dependency.
* Clear separation between client identity and host keystroke output.

## Macro system

* Named macros with variables and delays.
* Sequences for app launch, login fields, and form navigation.
* Storage on client, server, or both.
* Import and export for sharing.

## Setup and UX

* First run setup: pick device, pick transport, test keystrokes.
* One-tap connect to recent devices.
* Live preview shows what will be typed before sending.
* Per device profiles for layout, delays, and hotkeys.

## Results to date

**Server**

* ESP32 firmware accepts chunked messages with ack, retry, and auto reconnect over BLE and UDP.
* Legacy straight data mode supported.
* Optional AP web server hosts protocol docs, macro editor, and config.

**Client**

* Windows and Android apps share one protocol and feature set.
* Create and send messages to any server.
* Full BLE and UDP support.
* Up to 6 KB payloads validated.
* Network and identity configuration for servers.
* Macro define, run, and share.
* Auto transport selection.
* Picture to text helper for quick OCR to keystrokes.

## Expanded use with VoiceCatcher

**VoiceCatcher** is a small voice recognition layer that turns speech into KeyCatcher commands.

Examples:

* “Message to Xbox: my email is [jim@example.com](mailto:jim@example.com)”
* “Message to PC in ChatGPT: how do I cook frozen burgers in oven enter”

VoiceCatcher can address multiple servers by name, route commands, and apply per device macros.

## Common use cases

* Paste-blocked fields in VDI or kiosk environments.
* Moving text from phone to locked down desktop.
* Fast account entry during demos or QA.
* Accessibility workflows where speech or OCR becomes keystrokes.

## Roadmap highlights

* Per app keymaps and IME friendly modes.
* Encrypted UDP sessions.
* Multi-device broadcast and round-robin.
* On-device storage for larger macro packs.
* Scriptable actions for function keys and window focus.

If you want this rewritten as a README, a 1-page product brief, or a slide, tell me which format and I will drop it in that exact shape.
