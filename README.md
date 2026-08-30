# @brennanr/react-virtualized

A fork of [bvaughn/react-virtualized](https://github.com/bvaughn/react-virtualized)
at 9.22.6, carrying one behavioural change.

**All documentation lives upstream** — the API here is identical:
[README](https://github.com/bvaughn/react-virtualized/blob/master/README.md) ·
[docs](https://github.com/bvaughn/react-virtualized/blob/master/docs/README.md) ·
[demos](https://bvaughn.github.io/react-virtualized/)

## Why this fork exists

Both changes come from the same place. Modal libraries lock background
scrolling on iOS by pinning `document.body` with `position: fixed; top: -scrollY`, because that is the only technique Safari honours — Radix,
Headless UI, MUI and `@zag-js/dismissable` (which most apps get transitively
through Ark UI and Chakra UI) all do it. `WindowScroller` does not expect it,
and reaches into global document state in two ways that break under it.

**Body's inline `pointer-events`.** `WindowScroller` suppressed hit testing
during a scroll by writing that property, saving the previous value in a
module global and restoring it 150ms later. Dialogs claim the same property
with the same save-and-restore shape — zag even names its variable
`originalBodyPointerEvents` too. Two such cycles over one global are safe only
while they nest, and pinning the body is itself what scrolls the window, so
they interleave: the dialog captures the scroll's transient `none` as the
page's resting value and restores it on close, leaving the document unable to
receive any pointer event while still scrolling normally. It never recovers,
because the next dialog captures the same poisoned value.

**Position cached from a collapsed document.** `WindowScroller` caches where
its grid sits in the document and recomputes it on resize. While the body is
pinned the document collapses to the viewport, so that measurement is short by
the scroll offset — and Safari fires a resize every time its toolbar moves.
Once the modal closes the grid renders a band of rows nowhere near the
viewport, leaving the screen blank until something forces a fresh measurement.

Upstream exposes no way to opt out of either, and the project is frozen: four
releases since 2020, and an issue tracker held at zero open issues. So the
behaviour is changed here instead — the suppression becomes a class on the
document element, and the position measurement is skipped while the body is
out of flow. Coverage, timing and `Grid`'s own inner-container suppression are
unchanged.

[**FORK.md**](FORK.md) has the full detail: the captured interleave, what
changed, how to build and release, and how to run the tests.

## Install

Released as a tarball attached to a GitHub Release rather than to a registry:

```jsonc
"@brennanr/react-virtualized": "https://github.com/BrennanR/react-virtualized/releases/download/v9.22.6-fork.2/brennanr-react-virtualized-9.22.6-fork.2.tgz"
```

Import `@brennanr/react-virtualized/styles.css` as you would upstream's — the
class this fork relies on is defined there.

## License

MIT, as upstream. Copyright (c) 2015 Brian Vaughn. See [LICENSE](LICENSE).

If you are looking to sponsor the work this is built on,
[sponsor Brian Vaughn](https://github.com/sponsors/bvaughn/) — this fork is a
one-line behavioural change on top of his library.
