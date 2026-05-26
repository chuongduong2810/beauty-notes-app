# Invisible DOM Textarea for Note Editing

Note display is pure WebGL (ADR-0001), but text *input* is bridged through a single transparent `<textarea>` positioned over the focused Note via R3F's camera projection. Only one textarea exists at a time, only while a Note is being edited. The textarea is invisible; its value is mirrored into the WebGL text mesh in realtime.

We considered building a custom WebGL caret with our own keyboard, selection, and IME handling. Three concrete scenarios ruled it out: IME composition events (`compositionstart`/`update`/`end`) only fire on focusable DOM elements, so non-Latin input — including Vietnamese, the primary author's locale — cannot work without one; iPadOS only surfaces the on-screen keyboard for focusable DOM elements, breaking the brief's tablet target; the clipboard API requires an activated DOM focus context, so paste from other apps silently fails otherwise. Every path back to "real" input quietly reintroduces a hidden DOM input, so we adopt it explicitly.

We also considered a modal editor pane (double-click opens a sidebar). Rejected because it breaks the in-place tactile gesture that the rest of the design is paying for.
