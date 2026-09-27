/**
 * Demo page entry: the only side effect, kept out of `demo.js` so that module stays importable
 * (the seam suite imports it to reuse the graph model against a replaced backend).
 */
import { bootVanillaDemo } from './demo.js'

bootVanillaDemo()
