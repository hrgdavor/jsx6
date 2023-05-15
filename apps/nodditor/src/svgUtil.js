import { hSvg } from '@jsx6/jsx6'

/**
 *
 * @param {number} strength
 * @returns
 */
export const makeLine = strength =>
  hSvg('path', {
    strength,
    style: `vector-effect:non-scaling-stroke;pointer-events:auto;cursor:pointer`,
    fill: 'none',
  })
