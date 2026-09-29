/**
 * WGSL shader for batched cubic Bezier strokes.
 *
 * Each instance draws one edge as a triangle strip of `segmentsPerCurve + 1`
 * sampled points; the stroke is extruded by `width / 2` in SCREEN pixels along
 * the normal of the normalized tangent, so the rendered thickness does not
 * depend on zoom. The viewport is `screenPos = worldPos * zoom + pan`.
 */
export const LINE_SHADER = `
struct Uniforms {
  canvasSize: vec2f,
  viewTransform: vec3f, // x: panX, y: panY, z: zoomScale
  segmentsPerCurve: f32,
};

struct Edge {
  p0: vec2f, c0: vec2f, c1: vec2f, p1: vec2f,
  color: vec4f,
  width: f32, // Width in SCREEN PIXELS
  pad: vec3f,
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
  let pan = u.viewTransform.xy;
  let zoom = u.viewTransform.z;
  let screenPos = worldPos * zoom + pan;

  // 3. Extrude stroke width in SCREEN PIXELS (independent of zoom level)
  let normal = vec2f(-safeTan.y, safeTan.x) * (edge.width * 0.5);
  let finalScreenPos = screenPos + normal * side;

  // 4. Convert Screen Space [0..CanvasSize] to Clip Space [-1..1]
  let clip = (finalScreenPos / u.canvasSize) * 2.0 - 1.0;

  return VSOutput(vec4f(clip.x, -clip.y, 0.0, 1.0), edge.color);
}

@fragment fn fs(in: VSOutput) -> @location(0) vec4f {
  return in.color;
}
`
