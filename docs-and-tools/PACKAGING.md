# Cutting a deployment package

Until 2026-09-07 every package was a **manual copy** governed by an exclusion list written in
prose inside each DEPLOY.md and re-derived from memory each release. Since then the definition of
what ships lives in exactly one place.

| file | role |
|---|---|
| `package-allowlist.ps1` | **The single definition** of what a package contains. Not runnable; the other two dot-source it. |
| `build-package.ps1` | Cuts a package into a dated folder, then verifies what it just wrote. |
| `verify-package.ps1` | Answers one question: is the package on disk still exactly this tree? |

`build-package.ps1` and `verify-package.ps1` are **byte-identical** to the copies in
`methodica-math-ratio-01/-02` and `methodica-science-mass-measure-02`. Only
`package-allowlist.ps1` differs between units — see its `.NOTES` block for what differs here and
why.

## Running

```powershell
pwsh -File docs-and-tools/build-package.ps1 -DryRun   # what would ship, writing nothing
pwsh -File docs-and-tools/build-package.ps1           # cut into deployments/<today>
pwsh -File docs-and-tools/verify-package.ps1          # check the newest package
```

`build-package.ps1` **refuses** a dirty working tree (`-AllowDirty` overrides) and a non-empty
target (`-Force` overrides, and preserves the hand-written DEPLOY.md). `deployments/` sits
**outside** the repo, so an overwrite is not recoverable.

## Why an allowlist, not a denylist

`kata-api-key.txt` is a **live key at the repo root** in this unit. Under a denylist, one missing
entry publishes it. Under an allowlist a root-level file ships only if `$RootFiles` names it, and
`$RootFiles` is `index.html`.

The failure mode is on record: the 2026-09-02 DEPLOY.md documents an earlier package cut the same
day being destroyed — *"it is gone, and nothing from it should be uploaded"* — and every release
before that restated the exclusion list from memory.

⚠️ "Allowlist" here means packaging only. It is unrelated to `KNOWN_PHANTOM_SCREENS` and
`KNOWN_UNFLUSHED` in `_test/verify-report.js`, which `_test/README.md` also calls allowlists —
those record dead code, not deliverables.

## The four checks in verify-package

| check | question |
|---|---|
| FORWARD | every file in the package exists in the tree with identical content (MD5) |
| REVERSE | every file the allowlist ships is **present** in the package — the check a plain diff misses, because a file added to the tree after the cut looks fine and ships as a 404 |
| HYGIENE | no key, `*.ps1`, `*.log`, `*.bat`, `index_dev.html`, `README.md` or `_`-prefixed path in the package |
| COMMIT | the commit DEPLOY.md claims versus HEAD — and only a change to a **shipped** file marks a package stale, so a commit touching `_test/` or `docs-and-tools/` does not |

Each run also prints a **duplicate** line: how many blobs appear in more than one place. It is
informational and never fails the run, but it is what keeps the remaining duplication visible.

## Two things specific to this unit

**`canvas-tall-gate.js` is load-bearing.** Every `index.html` loads it before `script.js`. It is in
`$ComponentFiles`; if it is ever removed from that list it stops shipping and nothing else notices,
because the string appears in no other document here.

**`translation/` is excluded but must never be deleted.** `data-00..05.ps1` are the only copy of
the hand-maintained string tables. It is a deliverable for the localisation vendor, not for the CDN.

## Running the test suite against a package

Both harnesses take a base path as their first argument:

```bash
node _test/verify-report.js ../../deployments/<date>
```

This is a cross-check, not a gate — the gate is `verify-package.ps1`. Since 2026-09-07 the harness
resolves its own stub library from `__dirname` rather than from the base path, so a package run is
clean rather than failing one assertion for a file a package correctly does not contain.
