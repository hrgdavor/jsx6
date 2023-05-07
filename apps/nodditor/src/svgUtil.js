import { hSvg } from '@jsx6/jsx6'

/**
 *
 * @param {number} strength
 * @param {string} color
 * @param {number} strokeW
 * @returns
 */
export const makeLine = (strength, color = 'black', strokeW = 2) =>
  hSvg('path', {
    strength,
    style: `vector-effect:non-scaling-stroke;stroke-width:${strokeW};pointer-events:auto;cursor:pointer`,
    fill: 'none',
    stroke: color,
  })
