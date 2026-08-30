# About this fork

`@brennanr/react-virtualized` — a fork of
[bvaughn/react-virtualized](https://github.com/bvaughn/react-virtualized),
branched from `c737715` (the 9.22.6 release). MIT, as upstream.

It carries two behavioural changes, both consequences of one thing:
modal libraries lock background scroll on iOS by pinning `document.body` with
`position: fixed; top: -scrollY`, and `WindowScroller` does not expect it.

## 1. Body's inline pointer-events (fork.1)

`WindowScroller` stops the browser hit testing the rows it is recycling while
the window scrolls. Upstream did that by writing `pointer-events: none` onto
`document.body`'s **inline style**, remembering the previous value in a module
global and putting it back 150ms after the last scroll event.

Modal libraries claim that same inline property for as long as a dialog is
open, using the same save-and-restore shape. `@zag-js/dismissable` — which
reaches most apps transitively, via Ark UI and Chakra UI — even names its
variable `originalBodyPointerEvents`, exactly as upstream does.

Two independent save/restore cycles over one global are safe only while they
nest. These interleave whenever opening a dialog is itself what makes the
window scroll, which is what an iOS scroll lock does when it pins the body at
`position: fixed; top: -scrollY`:

```
rv:   save ""     -> set "none"     rv acquires
zag:  save "none"                   zag acquires, capturing rv's transient value
zag:  set "none", data-inert
rv:   restore ""                    rv releases, clearing the dialog's own block
zag:  restore "none"                zag releases, making rv's transient value permanent
```

The page is then left unable to receive any pointer event, while still
scrolling normally, and nothing recovers it: `body` now reads
`pointer-events: none` as its resting value, so the next dialog captures that
and restores it again.

### What changed

`source/WindowScroller/utils/onScroll.js` now toggles a class on the document
element instead, with the rule that backs it in `source/styles.css`:

```css
.ReactVirtualized__scrolling body {
  pointer-events: none;
}
```

Same suppression, same coverage, same reset interval. The conflict goes away
structurally rather than by cooperation, because a class holds no value for
another library to read back, and an inline style outranks a class in the
cascade — so a dialog's own block wins for as long as it is open, and nothing
here can overwrite it.

Dropping the saved value also retires the guard that existed to stop several
`WindowScroller`s racing to record it first (upstream issue #379).
`classList.add` is idempotent.

Consumers must import `@brennanr/react-virtualized/styles.css` for the
optimisation to apply — as upstream already requires for its other classes.
Without it you lose the suppression, not correctness.

Note this is only the document-wide half of the optimisation. `Grid` scopes
the same suppression to its own inner scroll container
(`pointerEvents: isScrolling ? 'none' : ''`), and that is untouched.

## 2. Position cached while the body is out of flow (fork.2)

`WindowScroller` caches where its grid sits in the document, and recomputes
that on window resize:

```js
_positionFromTop = grid.getBoundingClientRect().top + window.scrollY;
```

While the body is pinned it is out of flow, so the document collapses to the
height of the viewport: the grid's `top` reads as roughly `-scrollY` and the
document's own `top` reads as `0`, making the cached position short by the
scroll offset. It is only recomputed on the next resize, so once the modal
closes and the scroll is restored, the grid renders the rows for about twice
the scroll position -- a band nowhere near the viewport, leaving the visible
area blank. Scrolling does not repair the cached value; it only slides
different rows through a window that is still misaligned.

Safari fires a resize every time its toolbar collapses or expands, which
happens constantly on a phone, so a resize routinely lands inside the lock.

`updatePosition` now skips the measurement while the body is out of flow
(`isBodyOutOfFlow` in `utils/dimensions.js`). The position already cached was
taken from a document in flow and is still correct, and nothing can be
scrolled to during a lock. Dimensions are still updated, since the viewport
itself is unaffected.

## Consuming it

Releases are published as a packed tarball attached to a GitHub Release, not
to a registry. Depend on the asset URL:

```jsonc
"@brennanr/react-virtualized": "https://github.com/BrennanR/react-virtualized/releases/download/v9.22.6-fork.2/brennanr-react-virtualized-9.22.6-fork.2.tgz"
```

Plain HTTPS on a public repo, so `npm ci` needs no credentials, and npm
records an integrity hash for the tarball in the consumer's lockfile. A
release asset is immutable, so unlike a branch it cannot move underneath an
install.

## Releasing

`dist/` and `styles.css` are build output and stay gitignored, as upstream has
them. `prepack` builds them, so the tarball can never disagree with source.

```bash
npm install --legacy-peer-deps && git checkout -- yarn.lock
npm pack
```

Upstream is a yarn project: `npm install` rewrites `yarn.lock` (swapping the
registry URLs) and drops a `package-lock.json`. The checkout above reverts the
first; the second is gitignored.

`npm pack` writes `brennanr-react-virtualized-<version>.tgz`. Bump `version`
in `package.json`, tag `v<version>`, create the GitHub Release, and attach
that file. Then update the URL in the consuming project.

Upstream's own `npm run build` additionally builds the demo site and the UMD
bundle, and drives everything through yarn; neither is needed here, so
`build:pack` covers only what is packed.

## Tests

The puppeteer-backed e2e suite does not run headless here, so run the jsdom
tests directly:

```bash
npx jest --no-watchman --runInBand \
  --config '{"setupFiles":["./source/jest-setup.js"],"roots":["./source"],"testRegex":".(jest|ssr).js$"}'
```

575 pass. `WindowScroller.jest.js` covers the change, including a test that
pins the invariant this fork exists for: a `pointer-events` value owned by
another library survives a scroll untouched.
