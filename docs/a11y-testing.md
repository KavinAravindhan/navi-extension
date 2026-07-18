# Manual accessibility test script

Screen reader behavior cannot be covered by unit tests. Run this checklist
before each release, once per screen reader: **NVDA** (Windows), **JAWS**
(Windows), **VoiceOver** (Mac, Cmd+F5). Record pass/fail per row.

Setup: build + load the extension, open a Google Sheet with data, start the
screen reader, and switch NAVI to screen-reader mode (menu → "Read out loud:
My screen reader", or Ctrl+Alt+Z).

## 1. No voice collisions (NAVI-002)

- [ ] With screen-reader mode ON, NAVI never speaks with its own voice —
      summaries and answers are read by the screen reader only (via the
      message log's live region)
- [ ] With NAVI-voice mode ON, the screen reader does NOT read incoming
      messages on its own (log is aria-live=off) — only NAVI's voice speaks
- [ ] Switching modes in the menu announces the change through the new mode

## 2. Panel navigation

- [ ] The floating icon is reachable with Tab and announced as
      "Open NAVI Assistant, button"; Enter and Space both open the panel
- [ ] On open, focus lands in the message input ("Message NAVI")
- [ ] All buttons announce meaningful names (pause/resume, stop, close,
      voice input, send) — never just an emoji character
- [ ] The mic button reports pressed/not pressed as listening toggles
- [ ] Closing the panel returns focus to the floating icon
- [ ] The panel is announced as the "NAVI Assistant" landmark and does NOT
      trap focus — the user can Tab/navigate back to the sheet at any time

## 3. Menu (Alt/Option+M)

- [ ] Opening announces "Menu opened" + usage hints
- [ ] Arrow keys move item by item; each item is announced with its
      checked state; Enter activates; Escape closes and focus returns
      to the input

## 4. Voice input while the screen reader talks (NAVI-009)

- [ ] Click the mic while the screen reader is mid-sentence: NAVI must not
      transcribe the screen reader's speech as user input (half-duplex:
      NAVI's own voice stops on listen; keep SR output brief before dictating)
- [ ] Blocked mic (block permission in site settings): NAVI announces the
      recovery instructions instead of failing silently

## 5. Shortcuts under a screen reader

- [ ] Alt/Option+N opens NAVI while the sheet grid has focus
- [ ] Bare Shift tap pause/resume does not fire while typing text with
      Shift held (chords are ignored)
- [ ] Ctrl+Alt+Z switches to screen-reader mode and announces the active
      cell reference
- [ ] None of NAVI's shortcuts collide with the screen reader's own keys
      (NVDA: Insert/CapsLock combos; JAWS: Insert combos; VoiceOver: Ctrl+Option)

## Known limitations (current build)

- Web Speech voice input cannot pick a microphone or apply echo
  cancellation; the robust fix (Whisper capture) ships in Step 5
- The active-cell announcement reads Google Sheets' Name Box and may lag
  the selection by a moment
