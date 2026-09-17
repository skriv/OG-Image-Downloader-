# Push rules

Follow this file whenever the user asks to commit and/or push.

## Commit messages

All git commit messages must be in English only.

## Before commit

1. Inspect the working tree (`git status`, `git diff`).
2. Show the user:
   - a clear **list of changes** that will be committed (files + short summary of what changed);
   - the **current app version** (from `package.json` / `public/manifest.json`).
3. **Wait** for the user to decide the version for this release (keep current, or bump patch/minor/major / set an explicit version).
4. Do **not** commit until the version decision is confirmed.

## After the user chooses the version

1. Apply that version **everywhere** it is tracked (keep them identical):
   - `package.json` → `version`
   - `public/manifest.json` → `version`
   - `README.md` → the `**Version:**` line only (no changelog)
   - `STORE.md` → `## Identity` → **Version:**
2. Update [`STORE.md`](STORE.md) for the release (English only):
   - refresh **Current features** if user-facing behavior changed;
   - add or adjust **Planned / upcoming** yourself when new work is discussed or deferred — do not wait for the user to edit the file.
3. Rebuild if needed (`npm run build`) and run tests (`npm test`) when code changed.
4. Commit with an English message, then push to `origin`.

## Scope

- Do not commit secrets, `node_modules/`, or `dist/` (see `.gitignore`).
- Only commit when the user asked to commit/push (or clearly implied it with “push” after local work).
