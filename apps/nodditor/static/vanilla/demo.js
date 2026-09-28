/**
 * Vanilla host for `jsx6-nodditor`.
 *
 * No JSX, no component framework, no signals: blocks are built with `document.createElement`, the
 * graph is plain JSON in `localStorage`, and everything else goes through the editor's documented
 * API. That is the point of this demo — it is the smallest host that is actually usable, so
 * anything it does NOT need is not part of the editor's contract.
 *
 * What a host must provide (this file is the reference for it):
 *   - a `<jsx6-nodditor>` element with a definite box (the editor pans/zooms inside it);
 *   - a `menu` generator returning an element for the current selection (or nothing);
 *   - a `typeMap` of factories — one fresh block per call — which `loadGraph`/undo/redo reuse;
 *   - block elements whose connectors carry `ncid` and `ne-connect="in|out"`;
 *   - `ne-drag` on the part of a block that moves it, `ne-nodrag` on parts that must not drag.
 *
 * The editor owns everything else: the canvas, the SVG line layer, connector discovery, selection,
 * drag-connect, marquee, keyboard, zoom/pan, undo/redo and the `ne-*` events.
 */
import { backend } from '../../src/runtime.js'

/* ------------------------------------------------------------------ graph model */

/** A block is any DOM element; this demo builds them with plain DOM calls. */
export function makeBlock(type, title, ports) {
  const el = document.createElement('div')
  el.className = 'vb'
  el.dataset.type = type

  const head = document.createElement('div')
  head.className = 'vb-title'
  head.setAttribute('ne-drag', '') // dragging this part moves the block
  head.textContent = title
  el.appendChild(head)

  const body = document.createElement('div')
  body.className = 'vb-body'
  for (const { ncid, dir, label } of ports) {
    const row = document.createElement('div')
    row.className = 'vb-row'
    row.setAttribute('ne-item', '') // the editor aligns the selection menu to these
    row.textContent = label
    const port = document.createElement('span')
    port.className = 'vb-port'
    // `ncid` is how the editor discovers a connector; `ne-connect` picks its side
    port.setAttribute('ncid', ncid)
    port.setAttribute('ne-connect', dir)
    row.appendChild(port)
    body.appendChild(row)
  }
  el.appendChild(body)
  return el
}

const PORTS = {
  Switch: [
    { ncid: 'i1', dir: 'in', label: 'in' },
    { ncid: 'o1', dir: 'out', label: 'on' },
    { ncid: 'o2', dir: 'out', label: 'off' },
  ],
  Message: [
    { ncid: 'i1', dir: 'in', label: 'text' },
    { ncid: 'o1', dir: 'out', label: 'out' },
  ],
  Value: [{ ncid: 'o1', dir: 'out', label: 'value' }],
}

/**
 * Factories, not singletons: `loadGraph` and undo/redo call one per block and the returned element
 * becomes the live block. This is all the editor needs for persistence to work.
 */
export const typeMap = Object.fromEntries(
  Object.keys(PORTS).map(type => [type, () => makeBlock(type, type, PORTS[type])]),
)

export const defaultGraph = {
  blocks: [
    { id: '1', type: 'Value', pos: [20, 30] },
    { id: '2', type: 'Switch', pos: [220, 20] },
    { id: '3', type: 'Message', pos: [220, 230] },
    { id: '4', type: 'Message', pos: [470, 230] },
  ],
  lines: [
    ['1/o1', '2/i1'],
    ['2/o1', '3/i1'],
    ['2/o2', '4/i1'],
  ],
}

/* ------------------------------------------------------------------ host wiring */

/**
 * Build the editor for `host` and wire a toolbar, a menu and persistence.
 *
 * A function rather than module-level side effects, so a test can instantiate it against a replaced
 * backend.
 *
 * @param {HTMLElement} host the `<jsx6-nodditor>` element
 * @param {{ persist?: boolean, onStatus?: (message: string) => void }} [options]
 */
export function startVanillaDemo(host, { persist = true, onStatus } = {}) {
  const setStatus = message => onStatus?.(message)
  let nextId = 0
  const newId = () => `n${++nextId}`

  const menu = document.createElement('div')
  menu.className = 'ne-menu'
  menu.style.cssText =
    'display:flex;gap:2px;padding:3px;border:solid 1px #bbb;background:#fff;border-radius:6px'
  const menuButton = (label, title, onClick) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'ne-bt'
    b.textContent = label
    b.title = title
    b.addEventListener('click', onClick)
    return b
  }

  // `menuGenerator` (NOT `menu`): the editor stores the generator under this name and calls it on
  // every selection change. Setting the wrong one silently produces no menu at all.
  host.menuGenerator = () => menu
  host.typeMap = typeMap
  host.zoomMin = 0.3
  host.zoomMax = 4
  host.snap = 0
  host.setAttribute('tabindex', '0')

  /* -- persistence: the whole graph, as plain JSON ---------------------------- */

  const save = () => {
    if (!persist) return
    try {
      localStorage.setItem('ne.vanilla.graph', JSON.stringify(host.saveGraph()))
    } catch (err) {
      console.warn('vanilla demo: could not persist the graph', err)
    }
  }

  const restore = () => {
    let stored = null
    if (persist) {
      try {
        stored = JSON.parse(localStorage.getItem('ne.vanilla.graph') || 'null')
      } catch (err) {
        console.warn('vanilla demo: stored graph was not JSON, using the default', err)
      }
    }
    host.loadGraph(stored || defaultGraph)
    // keep generated ids ahead of whatever was restored
    nextId = host.blocks.reduce((max, b) => Math.max(max, Number(String(b.id).replace(/\D/g, '')) || max), 0)
    setStatus(`${host.blocks.length} blocks`)
  }

  /* -- toolbar / menu actions ------------------------------------------------- */

  const addBlock = type => {
    const data = host.add(typeMap[type](), newId(), {
      type,
      pos: [40 + (host.blocks.length % 4) * 30, 40 + host.blocks.length * 20],
    })
    host.selectBlocks([data])
    setStatus(`added ${type} ${data.id}`)
    save()
  }

  /** Connect the first `out` of one selected block to the first `in` of the other. */
  const linkSelection = () => {
    const [a, b] = host.selectedBlocks || []
    if (!a || !b) {
      setStatus('link needs two selected blocks')
      return
    }
    const out = [...a.connectorMap.values()].find(c => c.dir === 'out')
    const inp = [...b.connectorMap.values()].find(c => c.dir === 'in')
    if (!out || !inp) {
      setStatus('no free out/in on the selected blocks')
      return
    }
    host.addConnectorFromTo(out.idFull, inp.idFull)
    setStatus(`${out.idFull} -> ${inp.idFull}`)
    save()
  }

  /**
   * Delete through the editor's own selection rule, but make the host's intent explicit.
   *
   * `deleteSelection()` acts on the selected LINE when one is selected, and a line selection is
   * sticky (it is not cleared by `selectBlocks`). A host that offers one "delete" for both — like
   * this toolbar — must therefore clear the line selection when the user's intent is the blocks.
   */
  const deleteSelection = () => {
    if ((host.selectedBlocks || []).length) host.selectConnector(null)
    host.deleteSelection()
    save()
  }

  menu.replaceChildren(
    menuButton('✕', 'Delete selection', deleteSelection),
    menuButton('↶', 'Undo', () => host.undo()),
    menuButton('↷', 'Redo', () => host.redo()),
    menuButton('⛶', 'Fit', () => host.resetView()),
  )

  /* -- events: the editor reports, the host decides --------------------------- */

  host.addEventListener('ne-move-done', save)
  host.addEventListener('ne-remove', () => {
    setStatus(`${host.blocks.length} blocks`)
    save()
  })
  host.addEventListener('ne-move', e => setStatus(`moved ${e.detail.connectors.length} connectors`))

  /** Wheel zoom needs a host listener: the editor exposes `changeZoomMouse`, it does not bind it. */
  host.addEventListener(
    'wheel',
    e => {
      e.preventDefault()
      host.changeZoomMouse(e.deltaY > 0 ? -0.1 : 0.1, e)
    },
    { passive: false },
  )

  /** Host-level keys: `L` links the selection (the editor keeps Delete/Backspace and Ctrl+Z/Y). */
  host.addEventListener('keydown', e => {
    if (e.key === 'l' && !e.ctrlKey && !e.metaKey && !e.altKey) linkSelection()
  })

  /* -- toolbar buttons -------------------------------------------------------- */

  document.addEventListener('click', e => {
    const act = e.target.closest?.('[data-act]')?.dataset.act
    if (!act) return
    if (act === 'switch') addBlock('Switch')
    else if (act === 'message') addBlock('Message')
    else if (act === 'link') linkSelection()
    else if (act === 'delete') deleteSelection()
    else if (act === 'undo') host.undo()
    else if (act === 'redo') host.redo()
    else if (act === 'fit') host.resetView()
    else if (act === 'snap') host.snap = e.target.checked ? 20 : 0
  })

  restore()
  return host
}

/* ------------------------------------------------------------------ page bootstrap */

/**
 * Boot when a `<jsx6-nodditor>` element is present, which is what the demo page provides. Guarded
 * (rather than a bare side effect) so importing this module in a test does not touch the page.
 */
export function bootVanillaDemo(options) {
  const host = document.querySelector('jsx6-nodditor')
  if (!host) return null
  return startVanillaDemo(host, {
    ...options,
    onStatus: message => {
      const out = document.querySelector('[data-role="status"]')
      if (out) out.textContent = message
      options?.onStatus?.(message)
    },
  })
}

// `backend` is read so the demo goes through the same seam as any other consumer.
export const demoBackend = backend
