/**
 * WGSL shader for batched cubic Bezier strokes.
 *
 * Each instance draws one edge as a triangle strip of `segmentsPerCurve + 1`
 * sampled points; the stroke is extruded by `width / 2` along the normal of
 * the normalized tangent. By default `width` is in WORLD units, so the rendered
 * thickness scales with zoom; an edge with `worldWidth: false` keeps the
 * legacy zoom-independent, screen-pixel width. The viewport is
 * `screenPos = worldPos * zoom + pan`.
 */
export const LINE_SHADER = `
struct Uniforms {
  canvasSize: vec2f,
  pan: vec2f, // panX, panY (bytes 8..15, same layout as before)
  zoom: f32, // zoomScale (bytes 16..19, same layout as before)
  segmentsPerCurve: f32,
};

struct Edge {
  p0: vec2f, c0: vec2f, c1: vec2f, p1: vec2f,
  color: vec4f,
  width: f32, // WORLD units when worldWidth > 0.5 (default); SCREEN pixels otherwise
  worldWidth: f32, // 1 = thickness scales with zoom; 0 = zoom-independent screen pixels
  pad: f32, // 64-byte stride, matching packEdges' 16 floats per edge
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read> edges: array<Edge>;

struct VSOutput {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f
};

fn sampleCubic(p0: vec2f, c0: vec2f, c1: vec2f, p1: vec2f, t: f32) -> vec2f {
  let u_t = 1.0 - t;
  return u_t * u_t * u_t * p0 + 3.0 * u_t * u_t * t * c0 + 3.0 * u_t * t * t * c1 + t * t * t * p1;
}

fn sampleTangent(p0: vec2f, c0: vec2f, c1: vec2f, p1: vec2f, t: f32) -> vec2f {
  let u_t = 1.0 - t;
  return 3.0 * u_t * u_t * (c0 - p0) + 6.0 * u_t * t * (c1 - c0) + 3.0 * t * t * (p1 - c1);
}

@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOutput {
  let edge = edges[ii];

  let segIndex = f32(vi / 2u);
  let side = select(-1.0, 1.0, (vi % 2u) == 1u);
  let t = clamp(segIndex / u.segmentsPerCurve, 0.0, 1.0);

  // 1. Evaluate curve in world space
  let worldPos = sampleCubic(edge.p0, edge.c0, edge.c1, edge.p1, t);
  let tan = sampleTangent(edge.p0, edge.c0, edge.c1, edge.p1, t);

  let tanLen = length(tan);
  let safeTan = select(vec2f(1.0, 0.0), tan / tanLen, tanLen > 0.0001);

  // 2. Apply Pan & Zoom to transform to screen coordinates
  let pan = u.pan;
  let zoom = u.zoom;
  let screenPos = worldPos * zoom + pan;

  // 3. Extrude the stroke width: world units scaled by zoom by default
  //    (thickness grows with zoom); plain screen pixels when worldWidth == 0.
  let wPx = select(edge.width, edge.width * u.zoom, edge.worldWidth > 0.5);
  let normal = vec2f(-safeTan.y, safeTan.x) * (wPx * 0.5);
  let finalScreenPos = screenPos + normal * side;

  // 4. Convert Screen Space [0..CanvasSize] to Clip Space [-1..1]
  let clip = (finalScreenPos / u.canvasSize) * 2.0 - 1.0;

  return VSOutput(vec4f(clip.x, -clip.y, 0.0, 1.0), edge.color);
}

@fragment fn fs(in: VSOutput) -> @location(0) vec4f {
  // The canvas is configured with alphaMode: premultiplied, so the color
  // must be premultiplied by its own alpha before it is composited.
  let c = in.color;
  return vec4f(c.r * c.a, c.g * c.a, c.b * c.a, c.a);
}
`

/**
 * Fullscreen-triangle blit: samples the supersampled buffer with a linear
 * filter and writes the downscaled image. Used when the renderer runs at
 * supersample > 1, because `copyTextureToTexture` does not filter.
 */
export const BLIT_SHADER = `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;

struct BlitOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs(@builtin(vertex_index) vi: u32) -> BlitOut {
  const corners = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let p = corners[vi];
  // The scene is rendered y-down into the buffer (texture row 0 = top of the
  // screen), so clip-to-UV is a direct 1:1 copy.
  return BlitOut(vec4f(p.x, p.y, 0.0, 1.0), vec2f((p.x + 1.0) * 0.5, (1.0 - p.y) * 0.5));
}

@fragment fn fs(@location(0) uv: vec2f) -> @location(0) vec4f {
  // textureSample(texture, sampler, coords) — explicit linear sampler.
  return textureSample(src, srcSampler, uv);
}
`
