/**
 * Minimal WebGPU typings for the subset of the API used by this library.
 * (Full typings live in `@webgpu/types`; this keeps the package dependency-free.)
 *
 * Global ambient declarations: they merge into lib.dom's `Navigator` and
 * `HTMLCanvasElement`.
 */
interface Navigator {
  gpu?: WebGPU
}

interface WebGPU {
  getPreferredCanvasFormat(): string
  requestAdapter(): Promise<GPUAdapter>
}

interface GPUAdapter {
  requestDevice(): Promise<GPUDevice>
}

interface GPUDevice {
  queue: GPUQueue
  /** resolves when the device is lost (driver reset, GPU crash, `destroy()`) */
  lost: Promise<{ reason: string; message: string }>
  destroy(): void
  createShaderModule(descriptor: { code: string }): unknown
  createRenderPipeline(descriptor: unknown): GPURenderPipeline
  createBuffer(descriptor: { size: number; usage: number }): GPUBuffer
  createTexture(descriptor: {
    size: readonly number[]
    format: string
    sampleCount: number
    usage: number
  }): GPUTexture
  createBindGroup(descriptor: unknown): unknown
  createSampler(descriptor: unknown): unknown
  createCommandEncoder(): GPURenderEncoder
}

interface GPUBuffer {
  destroy(): void
}

interface GPURenderPipeline {
  getBindGroupLayout(index: number): unknown
}

interface GPUQueue {
  writeBuffer(buffer: GPUBuffer, offset: number, data: ArrayBufferView): void
  submit(commandBuffers: unknown[]): void
}

interface GPURenderPassEncoder {
  setPipeline(pipeline: unknown): void
  setBindGroup(index: number, bindGroup: unknown): void
  draw(vertexCount: number, instanceCount: number): void
  end(): void
}

interface GPUCanvasCommandBuffer {
  end(): void
}

interface GPURenderEncoder {
  beginRenderPass(descriptor: unknown): GPURenderPassEncoder
  finish(): GPUCanvasCommandBuffer
}

interface GPUTexture {
  readonly size: readonly number[]
  createView(): unknown
  destroy(): void
}

interface GPUCanvasContext {
  configure(descriptor: unknown): void
  unconfigure(): void
  getCurrentTexture(): GPUTexture
}

interface HTMLCanvasElement {
  getContext(contextId: 'webgpu'): GPUCanvasContext | null
}

declare const GPUBufferUsage: {
  MAP_READ: number
  MAP_WRITE: number
  COPY_SRC: number
  COPY_DST: number
  UNIFORM: number
  STORAGE: number
}

declare const GPUTextureUsage: {
  RENDER_ATTACHMENT: number
  TEXTURE_BINDING: number
  COPY_SRC: number
  COPY_DST: number
}
