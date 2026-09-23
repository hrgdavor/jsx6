import { toDomNode } from './toDomNode.js'
import { disposeNode } from './dispose.js'

export function remove(child) {
  // `parent` is declared outside the try block on purpose: when it was declared inside,
  // the catch block resolved the identifier to the global `window.parent` and dumped the
  // entire window/document graph to the console.
  const _child = toDomNode(child)
  // P2-1 stage 2: release the subtree's signal bindings and handlers first, while the node is
  // still attached (a disposer may still need its DOM context). Disposal never throws and never
  // detaches, so the detach below behaves exactly as before — including throwing for an orphan.
  disposeNode(_child)
  const parent = _child?.parentNode
  try {
    parent.removeChild(_child)
  } catch (error) {
    // Keep this a single-line string: logging the node objects themselves can dump a whole
    // detached subtree (or, for the global `parent`, the entire window) into the console.
    console.error(`failed to remove child: ${describe(_child)} (parent: ${describe(parent)})`)
    throw error
  }
}

const describe = node => (node ? `${node.nodeName || node.constructor?.name || typeof node}` : String(node))