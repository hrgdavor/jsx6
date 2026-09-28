# Migrating to variable-driven styling

## Why your blocks are in the corner

They are all at `(0, 0)` because the editor no longer positions them with an inline style. Position is
published as CSS custom properties (`--ne-x`, `--ne-y`) and **`static/nodditor.css` is what turns them
into a transform**:

```css
.ne-block {
  transform: translateX(var(--ne-x, 0px)) translateY(var(--ne-y, 0px));
}
```

If that stylesheet is not loaded, `.ne-block` is an unstyled `<div>`: no `position: absolute`, no
`transform`, so every block stacks at the origin. Nothing is broken in the editor — the stylesheet is a
**required** dependency now, which is the price of not writing styles from JavaScript.

## The fix (one line of HTML)

Add the library stylesheet next to the editor:

```html
<link rel="stylesheet" href="…/@jsx6/nodditor/static/nodditor.css" />
```

Any of these works — pick whichever fits your build:

| setup | what to do |
| --- | --- |
| `<link>` in HTML | point at `static/nodditor.css` (or your copied path) |
| CSS entry (`@import`) | `@import '…/@jsx6/nodditor/static/nodditor.css';` |
| bundler that inlines CSS | `import '@jsx6/nodditor/static/nodditor.css'` |
| no build step / CDN | `<link rel="stylesheet" href="https://unpkg.com/@jsx6/nodditor/static/nodditor.css" />` |
| copy-paste | paste the file's contents into your own stylesheet — it is plain CSS with no imports |

That single file is all the geometry the editor needs. It is self-contained (no `@import`s), so
copying it into your own CSS is a supported option, not a hack.

### If you already link `NodeEditor.css`

Keep linking it — it still works. It is now a two-line shim:

```css
@import url('./nodditor.css'); /* library geometry — required */
@import url('./ne-demo.css'); /* demo look — optional            */
```

But prefer switching to `nodditor.css` directly, because **`ne-demo.css` is the demo's appearance, not
the library's**: it carries the demo menu chrome and the `.ne-demo-editor` box (`outline` +
`contain: strict`). An app brings its own block/menu markup and should not inherit the demo's look.

## What you can and should style yourself

The editor owns only the geometry plus a minimal default look for the controls it creates (zoom UI,
marquee). Everything is overridable from CSS:

```css
/* your app */
jsx6-nodditor {
  --ne-zoom-z: 5; /* lift the zoom controls above an overlay of yours */
}

.ne-block {
  /* your block look; position/transform stay from nodditor.css */
  background: #fff;
  border: solid 1px #ccc;
  border-radius: 4px;
}

.ne-zoom-ui {
  /* restyle the zoom controls however you like */
  background: #222;
  color: #eee;
}
```

| custom property | who writes it | what it drives |
| --- | --- | --- |
| `--ne-x`, `--ne-y` | the editor (per block) | block position |
| `--ne-zoom`, `--ne-zoom-w`, `--ne-zoom-h` | the editor (per canvas) | zoom scale + unscaled size |
| `--ne-menu-x`, `--ne-menu-y` | the editor (per menu) | selection menu position |
| `--ne-marquee-x/-y/-w/-h` | the editor (while dragging) | marquee rectangle |
| `--ne-content-z`, `--ne-zoom-z`, `--ne-marquee-z` | **you** (optional) | stacking |

## Class names: who owns what

| class | owner | meaning |
| --- | --- | --- |
| `.ne-canvas` | **library** | the pannable/zoomable layer (do not reuse) |
| `.ne-svg-layer` | **library** | the line layer inside the canvas |
| `.ne-block` | **shared** | your block element; the library supplies its geometry, your stylesheet its look |
| `.ne-content` | **you** (conventional) | a block's body — used by the standard block markup |
| `.ne-title`, `.ne-item`, `[ne-drag]`, `[ne-connect]` | **you** | block internals |
| `.ne-menu`, `.ne-zoom-ui`, `.ne-marquee` | **library** | editor-owned UI |

The library must never style a class your block markup owns: its stylesheet loads *after* yours, so
such a rule would override your blocks. That is exactly how the `.ne-content` mix-up collapsed the
block bodies (they became `position: absolute` and escaped their box).

## What changed, precisely

1. **No inline styles.** The editor no longer writes `el.style.left/top/width/height/transform/display`.
   It writes custom properties via `style.setProperty('--ne-…')`, and the stylesheet consumes them.
2. **The canvas layer is `.ne-canvas`** (it used to have its layout inline, under no class).
   Do **not** name it `.ne-content` in your own CSS: `.ne-content` is a **block's body** in the
   standard block markup, and the two must stay separate.
3. **Menu visibility uses the `hidden` attribute**, not `style.display`. If you generate the menu
   element, do not force `display` on it; the editor toggles `hidden` and `nodditor.css` maps
   `[hidden]` to `display: none`.
4. **The menu is positioned for you.** Do not set `left`/`top` on your own menu element — the editor
   publishes `--ne-menu-x/-y`. If you need different placement, override `.ne-menu` in your CSS.
5. **Lines have no accessibility markup** (no `role`, `tabindex` or `aria-label`) and are not
   focusable, which is what removes the gray focus box around a selected line. Blocks keep
   `role="group"`, `tabindex` and a stable `aria-label` (`"Switch 1"`) because the keyboard flow
   (Enter / arrows / Delete) depends on them.
6. **No selection-status text.** The editor used to inject a visually-hidden `aria-live` element and
   write "block 1 selected" / "selection cleared" into it; that element is gone. If you were reading
   or styling `.ne-sr-status`, drop it.

## Class names: who owns what

| class | owner | meaning |
| --- | --- | --- |
| `.ne-canvas` | **library** | the pannable/zoomable layer (do not reuse) |
| `.ne-svg-layer` | **library** | the line layer inside the canvas |
| `.ne-block` | **shared** | your block element; the library supplies its geometry, your stylesheet its look |
| `.ne-content` | **you** (conventional) | a block's body — used by the standard block markup |
| `.ne-title`, `.ne-item`, `[ne-drag]`, `[ne-connect]`, `[ne-nid]` | **you** | block internals |
| `.ne-menu`, `.ne-zoom-ui`, `.ne-marquee` | **library** | editor-owned UI |

## Checking your integration

A quick sanity check in the browser console:

```js
const ed = document.querySelector('jsx6-nodditor')
getComputedStyle(ed.querySelector('.ne-block')).transform // must be translateX(...) translateY(...)
getComputedStyle(ed.contentArea).position // must be 'absolute'
```

If `transform` is `none`, the stylesheet is not loaded. If `transform` never changes as you drag a
block, `--ne-x`/`--ne-y` are being set but no rule consumes them — you are linking an old copy of the
stylesheet.
