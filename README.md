# @brennanr/react-virtualized

A fork of [bvaughn/react-virtualized](https://github.com/bvaughn/react-virtualized)
at 9.22.6, carrying one behavioural change.

**All documentation lives upstream** — the API here is identical:
[README](https://github.com/bvaughn/react-virtualized/blob/master/README.md) ·
[docs](https://github.com/bvaughn/react-virtualized/blob/master/docs/README.md) ·
[demos](https://bvaughn.github.io/react-virtualized/)

## Why this fork exists

`WindowScroller` stopped the browser hit testing recycled rows during a scroll
by writing `pointer-events: none` onto `document.body`'s **inline style**,
saving the previous value in a module global and restoring it 150ms later.

Modal libraries claim that same inline property for as long as a dialog is
open, with the same save-and-restore shape — `@zag-js/dismissable`, which most
apps get transitively through Ark UI and Chakra UI, even names its variable
`originalBodyPointerEvents` too. Two save/restore cycles over one global are
safe only while they nest, and they interleave whenever opening a dialog is
itself what scrolls the window, which is what an iOS scroll lock does. The
dialog then captures the scroll's transient `none` as the page's resting value
and restores it on close, leaving the document unable to receive any pointer
event while still scrolling normally — and unrecoverable, because the next
dialog captures the same poisoned value again.

Upstream exposes no way to opt out, and the project is frozen: four releases
since 2020, and an issue tracker held at zero open issues. So the behaviour is
changed here instead.

This fork expresses the same suppression as a class on the document element,
so the two libraries stop sharing storage. Coverage, timing and `Grid`'s own
inner-container suppression are unchanged.

[**FORK.md**](FORK.md) has the full detail: the captured interleave, what
changed, how to build and release, and how to run the tests.

## Install

Released as a tarball attached to a GitHub Release rather than to a registry:

```jsonc
"@brennanr/react-virtualized": "https://github.com/BrennanR/react-virtualized/releases/download/v9.22.6-fork.1/brennanr-react-virtualized-9.22.6-fork.1.tgz"
```

Import `@brennanr/react-virtualized/styles.css` as you would upstream's — the
class this fork relies on is defined there.

## License

MIT, as upstream. Copyright (c) 2015 Brian Vaughn. See [LICENSE](LICENSE).

If you are looking to sponsor the work this is built on,
[sponsor Brian Vaughn](https://github.com/sponsors/bvaughn/) — this fork is a
one-line behavioural change on top of his library.
