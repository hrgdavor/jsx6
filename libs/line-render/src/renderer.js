import { packEdges } from './curve.js'
import { LINE_SHADER, BLIT_SHADER } from './shader.js'

/** One edge = 16 floats in the GPU buffer (see `packEdges`). */
const FLOATS_PER_EDGE = 16

/** Canvas format used when `navigator.gpu` cannot be asked (borrowed device, stubbed global). */
const FALLBACK_FORMAT = 'bgra8unorm'

/**
 * WebGPU renderer for a batch of cubic Bezier edges.
 *
 * The viewport is `pan + zoom` (`screenPos = worldPos * zoom + pan`) and the
 * shader extrudes each stroke in world units by default (thickness scales
 * with zoom); an edge with `worldWidth: false` keeps a zoom-independent,
 * screen-pixel width. All edges are drawn in ONE instanced draw call;
 * the GPU buffers are created once and grown only when the batch gets
 * bigger, so a frame costs two `writeBuffer` calls, one cached bind group and
 * no allocation.
 *
 * The device and context are owned by the renderer: `init()` acquires them and
 * `dispose()` destroys them. A host that wants ONE device behind several
 * canvases hands the same `device` to every renderer instead (a borrowed device:
 * `init()` skips the request, `dispose()` leaves it alive) — see `create` and
 * the README section "Device ownership and sharing". A device lost behind the
 * renderer's back is reported through the `onLost` option (and makes `render()`
 * throw) so a host can fall back to another layer instead of drawing into a dead
 * device.
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
  /** @type {any} cached bind group for `edgeBuffer` + `uniformBuffer` */
  edgeBindGroup
  /** @type {Float32Array|undefined} scratch for `packEdges`, grown as the batch grows */
  packBuf
  /** @type {number} */
  edgeCap
  /** @type {string | null} */
  format
  /** @type {((info: {reason: string, message: string}) => void) | null} */
  onLost
  /** @type {boolean} set when the device is lost; `render()` then refuses to draw */
  lost
  /** @type {boolean} set by `dispose()`; filters the loss our own teardown raises */
  disposed
  /** @type {boolean} false when the device was borrowed (`device` option) and must not be destroyed */
  ownsDevice
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
   * @param {{segmentsPerCurve?: number, clear?: number[], supersample?: number, onLost?: ((info: {reason: string, message: string}) => void) | null, device?: any}} [opts]
   *   `supersample` (default 1) renders the scene into an offscreen buffer at
   *   `supersample` times the canvas resolution (with 4x MSAA) and
   *   linear-downscales it, which gives antialiasing close to the browser's
   *   SVG rasterizer at a cost of `supersample^2` pixels.
   *   `onLost` is called once when the GPU device is lost (driver reset, GPU
   *   process crash) so the host can fall back to another layer; it is NOT
   *   called for the loss raised by `dispose()`.
   *   `device` is a BORROWED `GPUDevice` (see `create`): `init()` then skips the
   *   adapter/device request and `dispose()` leaves the device alive — it
   *   releases only this renderer's own buffers, textures and canvas context.
   *   Destroying the device stays the caller's job.
   */
  constructor(
    canvas,
    {
      segmentsPerCurve = 32,
      clear = [0.05, 0.05, 0.08, 1],
      supersample = 1,
      onLost = null,
      device = null,
    } = {},
  ) {
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
    this.onLost = onLost
    this.lost = false
    this.disposed = false
    // A borrowed device is used as-is and never destroyed by `dispose()`
    this.ownsDevice = !device
    this.device = device
    this.ctx = null
    this.pipeline = null
    this.blitPipeline = null
    this.blitSampler = null
    this.blitBindGroup = null
    this.uniformBuffer = null
    this.edgeBuffer = null
    this.edgeBindGroup = null
    this.packBuf = undefined
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
   * Is WebGPU worth trying? A SYNCHRONOUS probe of `navigator.gpu`, cheap enough
   * for a UI decision (disable a "use the GPU layer" toggle, pick a layer at
   * startup) — it is not a guarantee: `requestAdapter()` can still return null
   * (blocked by flags/permissions, no compatible adapter) and a device can fail
   * to be created. `create()` covers those cases.
   *
   * @returns {boolean}
   */
  static isSupported() {
    return typeof navigator != 'undefined' && !!navigator.gpu
  }

  /**
   * Build AND initialise a renderer in one call, for hosts that treat a missing
   * GPU as a normal outcome: resolves with a ready renderer, or with `null`
   * after reporting the cause through `console.warn`. Use `new LineRenderer()`
   * + `init()` when the host wants to handle the error itself (they still throw,
   * and a usage error like a bad `supersample` always throws from here too).
   *
   * @param {HTMLCanvasElement} canvas
   * @param {ConstructorParameters<typeof LineRenderer>[1]} [opts]
   * @returns {Promise<LineRenderer|null>}
   */
  static async create(canvas, opts = {}) {
    // a usage error (bad supersample) throws here, and must not be swallowed
    const renderer = new LineRenderer(canvas, opts)
    try {
      await renderer.init()
    } catch (err) {
      // `dispose()` is safe after a half-finished `init()` and releases whatever
      // was acquired before the failure
      renderer.dispose()
      console.warn(`LineRenderer.create(): ${/** @type {Error} */ (err)?.message ?? err}`)
      return null
    }
    return renderer
  }

  /**
   * Acquire the WebGPU device, the canvas context and the render pipeline.
   *
   * With a borrowed `device` (the `device` option) only the context and the
   * pipeline are created here — no adapter is requested and the device is not
   * owned.
   *
   * @returns {Promise<LineRenderer>}
   */
  async init() {
    const gpu = navigator.gpu
    if (!this.device) {
      if (!gpu) {
        throw new Error(
          'WebGPU is not available (navigator.gpu) — use a Chromium-based browser with WebGPU enabled',
        )
      }
      const adapter = await gpu.requestAdapter()
      if (!adapter) throw new Error('No WebGPU adapter found')
      this.device = await adapter.requestDevice()
    }
    // A lost device (GPU reset, driver restart, GPU process crash) otherwise
    // freezes the canvas with no signal at all — the frame that never resolves,
    // not an exception. `onLost` is the host's cue to fall back to another
    // layer; when WE own the device, `dispose()` destroys it, which also resolves
    // `lost` (reason 'destroyed'), so the `disposed` flag filters our own
    // teardown out. A borrowed device can be destroyed by its owner, and that is
    // a real loss for this renderer — it is reported.
    this.device.lost?.then?.(info => {
      if (this.disposed) return
      this.lost = true
      this.onLost?.(info)
    })
    this.ctx = this.canvas.getContext('webgpu')
    if (!this.ctx) throw new Error('Could not acquire the webgpu canvas context')
    // a borrowed device implies a working `navigator.gpu` in practice; the
    // fallback keeps the borrowed path usable when it is stubbed away
    const format = gpu?.getPreferredCanvasFormat?.() ?? FALLBACK_FORMAT
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
      mipmapFilter: 'nearest',
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
   * Per frame the cost is two `writeBuffer` calls, one cached bind group and no
   * allocation: the packed edge data is written into a scratch buffer that is
   * only grown when the batch outgrows it, and the bind group is reused until
   * the edge buffer is replaced.
   *
   * @param {import('./curve.js').Edge[]} edges
   */
  render(edges) {
    if (!this.device || !this.format) {
      throw new Error('LineRenderer.init() must be called before render()')
    }
    if (this.lost) {
      throw new Error('LineRenderer: the WebGPU device was lost — see the `onLost` option')
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
        // the cached bind group points at the buffer that was just replaced
        this.edgeBindGroup = null
      }
      const packed = packEdges(edges, this.packBuf)
      this.packBuf = packed
      // a reused scratch is at least as long as this frame: upload only the live
      // prefix, because `writeBuffer` sends the whole view it is handed
      this.device.queue.writeBuffer(
        this.edgeBuffer,
        0,
        packed.length === needed ? packed : packed.subarray(0, needed),
      )
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
      if (!this.edgeBindGroup) {
        this.edgeBindGroup = this.device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.uniformBuffer } },
            { binding: 1, resource: { buffer: this.edgeBuffer } },
          ],
        })
      }
      pass.setPipeline(this.pipeline)
      pass.setBindGroup(0, this.edgeBindGroup)
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

  /**
   * Release the GPU resources.
   *
   * `init()` requested the adapter/device for this renderer, so `dispose()`
   * destroys them too: the canvas context is unconfigured, every buffer and
   * texture is destroyed and — unless the device was BORROWED (the `device`
   * option, see `create`) — the device is dropped. Dropping it affects every
   * holder, which is why an owned device must not be handed to another renderer.
   * See the README section "Device ownership and sharing". A renderer is
   * single-use afterwards. The device loss `device.destroy()` raises is not
   * reported to `onLost`.
   *
   * Safe to call when `init()` never ran (or failed half-way), and safe to call
   * twice.
   */
  dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.msaaTexture) {
      this.msaaTexture.destroy()
      this.msaaTexture = null
    }
    if (this.ssTexture) {
      this.ssTexture.destroy()
      this.ssTexture = null
    }
    this.blitBindGroup = null
    this.edgeBindGroup = null
    this.packBuf = undefined
    if (this.edgeBuffer) {
      this.edgeBuffer.destroy()
      this.edgeBuffer = null
    }
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy()
      this.uniformBuffer = null
    }
    this.edgeCap = 0
    const device = this.device
    const ownsDevice = this.ownsDevice
    this.device = null
    this.pipeline = null
    this.blitPipeline = null
    this.blitSampler = null
    this.format = null
    try {
      // the context may be gone already (init() failed before/at configure)
      this.ctx?.unconfigure?.()
    } catch {
      // nothing left to release
    }
    this.ctx = null
    if (ownsDevice) {
      try {
        // `lost` then resolves with reason 'destroyed'; `this.disposed` keeps
        // that out of the `onLost` callback
        device?.destroy?.()
      } catch {
        // the device is already gone
      }
    }
  }
}
