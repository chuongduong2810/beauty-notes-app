# 04 — Edit Note text via the invisible textarea overlay

**Tracer goal:** a User can double-click an existing Note, type into it, and have the text appear in the WebGL mesh as they type — with IME, spellcheck, and clipboard all working. This issue *is* the implementation of ADR-0002 and is the highest-risk slice in the v1 plan because it's where the pure-WebGL architecture meets real-world input.

Builds on Issue 03 (selection, drag, and the projection helper).

## Outcome (demo-able)

- Double-click an existing Note → it enters edit mode. The Camera does *not* move (focus-on-Note is a separate verb, deferred).
- A transparent `<textarea>` appears positioned exactly over the Note's screen-projected rectangle, automatically focused.
- Typing into the textarea updates the WebGL `<Text>` mesh in realtime (every keystroke).
- IME composition works: typing `cha` + `o` + diacritic produces `chào` correctly in both the textarea and the WebGL mesh.
- On iPadOS Safari, double-tapping the Note brings up the soft keyboard.
- `⌘V` / `Ctrl+V` pastes text from another app correctly into the Note.
- Browser spellcheck underlines work in the textarea (invisible visually, but caret/selection is responsive).
- Clicking outside the Note → blur → textarea hides → text commits to the database 500 ms after the last keystroke (or immediately on blur, whichever fires first).

## Why (links)

- **ADR-0002** — this issue is the literal implementation of that ADR
- PRD §5.3 (Edit verb)
- ADR-0005 (text commits 500 ms after typing pauses, or immediately on blur)

## Acceptance criteria

- [ ] The textarea's screen position matches the Note's screen-projected rectangle exactly during scroll/resize (use the projection helper from Issue 02). Verify by tinting the textarea pink temporarily during dev.
- [ ] The textarea is visually invisible in production — `opacity: 0` or `color: transparent; background: transparent; caret-color: transparent`. The caret is rendered into the WebGL mesh, not the textarea.
- [ ] Only one textarea exists at a time. Double-clicking a *different* Note while one is being edited → blur first Note (committing its text), then enter edit mode on the new one.
- [ ] Vietnamese input test: typing `c`, `h`, `a`, `o`, then a diacritic, produces `chào` in the WebGL mesh after composition ends. (This validates that we are *not* intercepting key events ourselves and *are* letting the textarea handle IME — the entire point of ADR-0002.)
- [ ] Pasting text from an external app into the Note works.
- [ ] Spellcheck underlines work (verifiable by typing "thsi is a tset" and seeing the OS spellcheck highlight, even though the textarea is invisible — selection/caret events still fire).
- [ ] On iPad, double-tap brings up the soft keyboard.
- [ ] Single keystroke in the WebGL text is visually no more than 1 frame behind the textarea (no perceptible lag).
- [ ] Commit fires 500 ms after the last keystroke *or* immediately on blur — whichever fires first. Network roundtrips never block typing.

## Touchpoints

### Database
- No schema change.
- `UPDATE notes SET body = $1, updated_at = now() WHERE id = $2` per debounced commit.

### Backend (Supabase)
- Standard update calls. RLS unchanged.

### Frontend
- A single `<NoteEditor>` component, rendered as a portal into a DOM layer that sits *above* the WebGL `<Canvas>`. It contains exactly one `<textarea>`.
- The Editor reads `editingNoteId` from Zustand. When non-null, it positions itself via the projection helper from Issue 02 and focuses the textarea.
- `onInput` on the textarea → write the current value into `notes[id].body` in Zustand. The `<Text>` mesh re-renders from that store value — *no* direct mesh manipulation.
- Debounced commit: use a 500 ms `setTimeout` reset on every keystroke. Cleared on blur (which also fires a final commit).
- `onBlur` of the textarea → set `editingNoteId = null`, hide the editor, commit if dirty.
- Double-click on `<Note>` → set `editingNoteId = thisNoteId`.
- `Escape` key while editing → blur (commits and exits).
- The textarea's `style`: `position: absolute`, dimensions from projection helper, `border: none`, `background: transparent`, `color: transparent`, `caret-color: transparent`, `resize: none`, `outline: none`, font-family/size matching the Note's text style so caret position aligns with the SDF text in WebGL.
- IME safety: do *not* attach `keydown` handlers that `preventDefault()` on the textarea — let composition events flow naturally.
- Configure `troika-three-text` font so the metrics match the textarea font (e.g. Inter at the same px size). Misalignment between textarea caret and WebGL glyph is the most likely bug and the most important thing to test.

## Out of scope

- Focus-on-Note Camera dolly (a separate Issue 05+; double-click stays as edit-mode trigger per Q18a, not as focus)
- Resize-aware text wrapping (Note size stays fixed in this issue)
- Per-Note font-size variation (font-size is a global constant for v1)
- Rich text, markdown rendering
- Spellcheck appearance polish — we accept that underlines are invisible; the *behaviour* must work
- Long-press to edit on tablet (double-tap is the only entry gesture in this issue)

## Risks

- **Caret/glyph misalignment.** If textarea font metrics don't match the SDF font metrics, the visible WebGL text and the invisible caret position drift. Mitigation: load the *same* font file into both troika and the textarea, use the same `font-size` and `line-height`. Test with a long wrapping note.
- **iPad zoom-on-focus.** iPadOS sometimes zooms the viewport when a textarea is focused with `font-size < 16px`. Use ≥16 px on the textarea to suppress this.
- **Position jitter under zoom (Issue 05+).** Once Camera zoom is implemented, the projection helper must update the textarea position every frame the Camera moves while editing. For this issue, Camera is fixed, so the position only needs to recompute on edit-mode entry.

## References

- **ADR-0002** (the implementation of)
- ADR-0001 (the constraint this issue is bridging)
- ADR-0005 (text commit timing)
- PRD § 5.3
- `CONTEXT.md` — Note
