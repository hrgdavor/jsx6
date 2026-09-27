import { backend } from './runtime.js'

/**
 *
 * @param {number} strength
 * @returns
 */
export const makeLine = strength =>
  backend.current.hSvg('path', {
    strength,
    style: `vector-effect:non-scaling-stroke;pointer-events:auto;cursor:pointer`,
    fill: 'none',
  })
