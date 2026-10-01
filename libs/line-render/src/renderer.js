import { packEdges } from './curve.js'
import { LINE_SHADER, BLIT_SHADER } from './shader.js'

/** One edge = 16 floats in the GPU buffer (see `packEdges`). */
const FLOATS_PER_EDGE = 16

/**
 * WebGPU renderer for a batch of cubic Bezier edges.
 *
 * The viewport is `pan + zoom` (`screenPos = worldPos * zoom + pan`) and the
 * shader extrudes each stroke in world units by default (thickness scales
 * with zoom); an edge with `worldWidth: false` keeps a zoom-independent,
 * screen-pixel width. All edges are drawn in ONE instanced draw call;
 * the GPU buffers are created once and grown only when the batch gets
 * bigger, so a frame costs two `writeBuffer` calls and no buffer churn.
 *
 * The canvas is TRANSPARENT over the page: the context is configured with
 * `alphaMode: 'premultiplied'` — a WebGPU canvas defaults to `opaque`, which
 * composites a transparent clear as a black rectangle (see
 * `docs/webgpu-pitfalls.md`, entry 13). A `clear` of `[0, 0, 0, 0]` (or any
 * half-transparent color) lets the page background show through; the default
 * clear `[0.05, 0.05, 0.08, 1]` is opaque and paints a dark background. Edge
 * colors are still passed as straight `RGBA 0..1` — the fragment shader
 * premultiplies them by alpha before compositing.
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
  /** @type {number} */
  supersample
  /** @type {any} */
  blitPipeline
  /** @type {any} */
  blitSampler
  /** @type {any} */
  blitBindGroup
  /** @type {any} */
  ssTexture
  /** @type {number} */
  ssW
  /** @type {number} */
  ssH

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{segmentsPerCurve?: number, clear?: number[], supersample?: number}} [opts]
   *   `supersample` (default 1) renders the scene into an offscreen buffer at
   *   `supersample` times the canvas resolution (with 4x MSAA) and
   *   linear-downscales it, which gives antialiasing close to the browser's
   *   SVG rasterizer at a cost of `supersample^2` pixels.
   */
  constructor(canvas, { segmentsPerCurve = 32, clear = [0.05, 0.05, 0.08, 1], supersample = 1 } = {}) {
    if (!(Number.isInteger(supersample) && supersample >= 1)) {
      throw new Error('supersample must be a positive integer')
    }
    this.canvas = canvas
    this.panX = 0
    this.panY = 0
    this.zoom = 1
    this.segmentsPerCurve = segmentsPerCurve
    this.clear = clear
    this.supersample = supersample
    this.device = null
    this.ctx = null
    this.pipeline = null
    this.blitPipeline = null
    this.blitSampler = null
    this.blitBindGroup = null
    this.uniformBuffer = null
    this.edgeBuffer = null
    this.edgeCap = 0
    this.format = null
    this.msaaTexture = null
    this.msaaW = 0
    this.msaaH = 0
    this.ssTexture = null
    this.ssW = 0
    this.ssH = 0
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
    // `premultiplied`, not the WebGPU default `opaque`: an opaque canvas
    // composites its pixels as alpha = 1, so a transparent clear renders as a
    // black rectangle. With `premultiplied` the canvas is truly transparent
    // where nothing is drawn — which requires both the clear value and the
    // fragment output (see LINE_SHADER) to be premultiplied by alpha.
    this.ctx.configure({ device: this.device, format, alphaMode: 'premultiplied' })
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
    // Fullscreen-triangle pipeline that linear-downscales the supersampled
    // buffer into the canvas (copyTextureToTexture cannot filter, so a
    // shader blit is used instead). Always created: the cost is one
    // pipeline + one sampler, and supersample can be switched at runtime.
    const blitModule = this.device.createShaderModule({ code: BLIT_SHADER })
    this.blitPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: blitModule, entryPoint: 'vs' },
      fragment: { module: blitModule, entryPoint: 'fs', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    })
    this.blitSampler = this.device.createSampler({
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
      magFilter: 'linear',
      minFilter: 'linear',
      mipFilterMode: 'none',
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
   * Set the supersample factor (1 = plain 4x MSAA path, >1 = supersampled
   * + linear downscale). The offscreen textures are recreated on the next
   * `render()` call; no re-initialization is needed.
   *
   * @param {number} ss
   */
  setSupersample(ss) {
    if (!(Number.isInteger(ss) && ss >= 1)) {
      throw new Error('supersample must be a positive integer')
    }
    this.supersample = ss
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
    const ss = this.supersample
    const w = this.canvas.width * ss
    const h = this.canvas.height * ss
    const encoder = this.device.createCommandEncoder()
    // MSAA: the pass renders into an offscreen 4-sample texture (the color
    // attachment) and resolves it into a (1-sample) texture via
    // `resolveTarget` — per the spec the attachment must be multisampled
    // and the resolve target single-sampled. With supersample > 1 the
    // resolve target is an intermediate buffer that is linearly downscaled
    // into the canvas by a second pass.
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
    let resolveTarget
    if (ss > 1) {
      if (!this.ssTexture || this.ssW !== w || this.ssH !== h) {
        if (this.ssTexture) this.ssTexture.destroy()
        this.ssTexture = this.device.createTexture({
          size: [w, h],
          format,
          sampleCount: 1,
          // Rendered into as the MSAA resolve target, then sampled by the
          // blit shader — hence RENDER_ATTACHMENT | TEXTURE_BINDING.
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        })
        this.ssW = w
        this.ssH = h
        this.blitBindGroup = this.device.createBindGroup({
          layout: this.blitPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: this.ssTexture.createView() },
            { binding: 1, resource: this.blitSampler },
          ],
        })
      }
      resolveTarget = this.ssTexture
    } else {
      if (this.ssTexture) {
        this.ssTexture.destroy()
        this.ssTexture = null
        this.ssW = 0
        this.ssH = 0
        this.blitBindGroup = null
      }
      resolveTarget = this.ctx.getCurrentTexture()
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: this.msaaTexture.createView(),
          loadOp: 'clear',
          clearValue: this.clear,
          storeOp: 'store',
          resolveTarget: resolveTarget.createView(),
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
    if (ss > 1) {
      // Linear-downscale the supersampled buffer into the canvas.
      const blitPass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: this.ctx.getCurrentTexture().createView(),
            loadOp: 'clear',
            clearValue: this.clear,
            storeOp: 'store',
          },
        ],
      })
      blitPass.setPipeline(this.blitPipeline)
      blitPass.setBindGroup(0, this.blitBindGroup)
      blitPass.draw(3)
      blitPass.end()
    }
    this.device.queue.submit([encoder.finish()])
  }

  /** Release the GPU resources. */
  dispose() {
    if (this.msaaTexture) {
      this.msaaTexture.destroy()
      this.msaaTexture = null
    }
    if (this.ssTexture) {
      this.ssTexture.destroy()
      this.ssTexture = null
    }
    this.blitBindGroup = null
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
