# Virtual scroll loop — RETIRED

**This package is a retired stub and is marked `"private": true`, so it is no longer published.**

It was published once as `@jsx6/scloop@1.0.0` containing an empty module (a single unused import and
no exports). The idea it was reserved for — a `Loop` backed by a scrolling skeleton, tracking state
and value separately, with content chosen from scroll speed between animation frames — was
implemented separately as [`@jsx6/virtual-scroll`](../virtual-scroll/README.md).

If a scroll-driven loop is wanted later, build it on `@jsx6/virtual-scroll` and re-use that package
rather than resurrecting this one.

The original notes are kept below for reference.

---

# Virtual scroll loop (original notes)

track state and value separately (more flexible and usable)
- state: config(select options), some toggles (edit vs view)
- value - value tht is actually given out set/get 
  - primitive like string, number, also array ..)
  - object (sub-form for deeper documents)


- background that is skeleton for scrolling
- optimization that sets content based on scroll speed between animation frames