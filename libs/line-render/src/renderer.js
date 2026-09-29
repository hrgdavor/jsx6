import { packEdges } from './curve.js'
import { LINE_SHADER } from './shader.js'

/** One edge = 16 floats in the GPU buffer (see `packEdges`). */
const FLOATS_PER_EDGE = 16

/**
 * WebGPU renderer for a batch of cubic Bezier edges.
 *
 * The viewport is `pan + zoom` (`screenPos = worldPos * zoom + pan`) and the
 * shader extrudes each stroke in screen pixels, so the line thickness stays
 * constant while zooming. All edges are drawn in ONE instanced draw call;
 * the GPU buffers are created once and grown only when the batch gets
 * bigger, so a frame costs two `writeBuffer` calls and no buffer churn.
 *
 * Needs a WebGPU-capable browser (Chromium with WebGPU enabled).
 */
export class LineRenderer {
  /** @type {HTMLCanvasElement} */
  canvas
  /** @type {number} */
  panX
  /** @type {number} */
  panY
  /** @type {number} */
  zoom
  /** @type {number} */
  segmentsPerCurve
  /** @type {number[]} */
  clear
  /** @type {any} */
  device
  /** @type {any} */
  ctx
  /** @type {any} */
  pipeline
  /** @type {any} */
  uniformBuffer
  /** @type {any} */
  edgeBuffer
  /** @type {number} */
  edgeCap
  /** @type {string | null} */
  format
  /** @type {any} */
  msaaTexture
  /** @type {number} */
  msaaW
  /** @type {number} */
  msaaH

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{segmentsPerCurve?: number, clear?: number[]}} [opts]
   */
  constructor(canvas, { segmentsPerCurve = 32, clear = [0.05, 0.05, 0.08, 1] } = {}) {
    this.canvas = canvas
    this.panX = 0
    this.panY = 0
    this.zoom = 1
    this.segmentsPerCurve = segmentsPerCurve
    this.clear = clear
    this.device = null
    this.ctx = null
    this.pipeline = null
    this.uniformBuffer = null
    this.edgeBuffer = null
    this.edgeCap = 0
    this.format = null
    this.msaaTexture = null
    this.msaaW = 0
    this.msaaH = 0
  }

  /**
   * Acquire the WebGPU device, the canvas context and the render pipeline.
   *
   * @returns {Promise<LineRenderer>}
   */
  async init() {
    const gpu = navigator.gpu
    if (!gpu) {
      throw new Error(
        'WebGPU is not available (navigator.gpu) — use a Chromium-based browser with WebGPU enabled',
      )
    }
    const adapter = await gpu.requestAdapter()
    if (!adapter) throw new Error('No WebGPU adapter found')
    this.device = await adapter.requestDevice()
    this.ctx = this.canvas.getContext('webgpu')
    if (!this.ctx) throw new Error('Could not acquire the webgpu canvas context')
    const format = gpu.getPreferredCanvasFormat()
    this.format = format
    this.ctx.configure({ device: this.device, format })
    const module = this.device.createShaderModule({ code: LINE_SHADER })
    this.pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: { module, entryPoint: 'vs' },
      fragment: { module, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-strip' },
      multisample: { count: 4 },
    })
    this.uniformBuffer = this.device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    return this
  }

  /**
   * Set the pan/zoom viewport (same convention nodditor uses).
   *
   * @param {number} panX
   * @param {number} panY
   * @param {number} zoom
   */
  setViewport(panX, panY, zoom) {
    this.panX = panX
    this.panY = panY
    this.zoom = zoom
  }

  /**
   * Clear the canvas and draw all edges in one instanced draw call.
   *
   * @param {import('./curve.js').Edge[]} edges
   */
  render(edges) {
    if (!this.device || !this.format) {
      throw new Error('LineRenderer.init() must be called before render()')
    }
    const format = this.format
    const encoder = this.device.createCommandEncoder()
    // MSAA: the pass renders into an offscreen 4-sample texture (the color
    // attachment) and resolves it into the (1-sample) canvas texture via
    // `resolveTarget` — per the spec the attachment must be multisampled
    // and the resolve target single-sampled
    const w = this.canvas.width
    const h = this.canvas.height
    if (!this.msaaTexture || this.msaaW !== w || this.msaaH !== h) {
      if (this.msaaTexture) this.msaaTexture.destroy()
      this.msaaTexture = this.device.createTexture({
        size: [w, h],
        format,
        sampleCount: 4,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      })
      this.msaaW = w
      this.msaaH = h
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.msaaTexture.createView(),
          loadOp: 'clear',
          clearValue: this.clear,
          storeOp: 'store',
          resolveTarget: this.ctx.getCurrentTexture().createView(),
        },
      ],
    })
    if (edges.length) {
      const needed = edges.length * FLOATS_PER_EDGE
      if (!this.edgeBuffer || needed > this.edgeCap) {
        if (this.edgeBuffer) this.edgeBuffer.destroy()
        this.edgeCap = Math.max(needed, 256)
        this.edgeBuffer = this.device.createBuffer({
          size: this.edgeCap * 4,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        })
      }
      this.device.queue.writeBuffer(this.edgeBuffer, 0, packEdges(edges))
      this.device.queue.writeBuffer(
        this.uniformBuffer,
        0,
        new Float32Array([
          this.canvas.width,
          this.canvas.height,
          this.panX,
          this.panY,
          this.zoom,
          this.segmentsPerCurve,
          0,
          0,
        ]),
      )
      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: { buffer: this.edgeBuffer } },
        ],
      })
      pass.setPipeline(this.pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.draw((this.segmentsPerCurve + 1) * 2, edges.length)
    }
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  /** Release the GPU resources. */
  dispose() {
    if (this.msaaTexture) {
      this.msaaTexture.destroy()
      this.msaaTexture = null
    }
    if (this.edgeBuffer) {
      this.edgeBuffer.destroy()
      this.edgeBuffer = null
    }
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy()
      this.uniformBuffer = null
    }
    this.device = null
    this.pipeline = null
    this.ctx = null
  }
}
