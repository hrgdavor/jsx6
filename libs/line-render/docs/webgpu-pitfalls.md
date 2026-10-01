# WebGPU line-render — caveats found and initialization errors

Retrospective of the MSAA + supersampling work done on `@jsx6/line-render`.
Each entry is: the symptom exactly as the browser/gate reported it, the root
cause, the fix, and the rule to remember. Chronological, from the original
"orange corner blob" bug through the final working supersample path.

## 1. Uniform fetch: no `vec3f` where the bytes say `vec2f`

**Symptom.** Scene rendered as a tiny orange blob in the corner instead of
the full line drawing.

**Root cause.** The shader fetched `pan` as `vec3f` from the 32-byte uniform
buffer. The data written was `vec2f canvasSize, vec2f pan, f32 zoom, ...` —
a `vec3f` fetch at that offset is not a valid uniform access.

**Fix.** Split the fetch into `pan: vec2f` (bytes 8..15) and `zoom: f32`
(bytes 16..19). Byte-identical data, valid fetches.

**Rule.** Uniform fetch types must match the bytes actually written,
field by field. If in doubt, pad/align explicitly — never rely on
"vec3 fits in the next 12 bytes".

## 2. `createTexture` takes `size: [w, h]`, not `width`/`height`

**Symptom.** `Required member is undefined` from `device.createTexture`.

**Root cause.** `GPUTextureDescriptor.size` is a `[width, height]` array in
the shipped API.

**Fix.** `size: [w, h]`; the local typings (`webgpu.d.ts`) updated to match.

**Rule.** `GPUTexture` exposes no `width`/`height` properties, so the renderer
tracks `msaaW/msaaH`/`ssW/ssH` itself and re-creates textures on size change.

## 3. MSAA resolve direction is not what the error sentence suggests

**Symptom.**
`Cannot set ... as a resolve target when the color attachment ... has a sample count of 1`.

**Root cause.** The pass was set up with the *single-sample* canvas as the
color attachment and the *4-sample* texture as the resolve target — backwards.

**Fix.** Per the spec (and Dawn's `ValidateResolveTarget`): the color
attachment's view MUST be the multisampled texture; `resolveTarget` MUST be
a single-sample texture of the same format.

**Rule.** Attachment = N samples, resolve = 1 sample, formats equal.

## 4. `copyTextureToTexture` cannot resample

**Question asked.** Does `copyTextureToTexture` support a `filterMode` so the
supersampled buffer can be downscaled in one API call?

**Answer: no — verified three ways.**
1. Spec: `spec/sections/copies.bs` defines the copy descriptors with no
   filter member (the only section files are `copies.bs` and
   `privacy-and-security.bs`; there is no separate IDL file).
2. Dawn `CommandEncoder.cpp`: no filter/copy-with-sampling code path.
3. WebGPU CTS `copyTextureToTexture.spec.ts`: greps for `filterMode|filter`
   match only JS `.filter(` array calls; `linear|nearest` — zero matches.

**Conclusion.** Copies are exact texel copies. A linear downscale must be a
shader: fullscreen triangle sampling a linear-filtered texture
(`BLIT_SHADER`).

## 5. WGSL has no `texture()` builtin

**Symptom.**
`Error while parsing WGSL: :19:10 error: unresolved call target 'texture'`

**Root cause.** `texture(sampler, coords)` is GLSL habit. WGSL's builtins are
`textureSample`, `textureLevel`, `textureLoad`, `textureGather`, etc.

**Fix.** `textureSample(...)`.

## 6. `textureSample` takes the sampler explicitly

**Symptom.**
`no matching call to 'textureSample(texture_2d<f32>, vec2<f32>)'` — with 15
candidate functions listed, all of the shape
`textureSample(texture, sampler, coords)`.

**Root cause.** Tried the 2-argument "associated sampler" form (the Metal
convention). This WGSL dialect requires the sampler as an explicit argument.

**Fix.** `textureSample(src, srcSampler, uv)`.

## 7. No backticks inside the WGSL template literal

**Symptom.** Gate failure — JS parse error reported *on a WGSL line*:
`Expected a semicolon ... after a statement` at
`// \`textureSample\` uses the associated sampler...`

**Root cause.** The shader is a JS template literal; backticks inside a
comment terminated the literal early, so the rest of the file became a
syntax error. (The error pointing at a WGSL line is the tell: a JS parser
cannot parse WGSL — it was already outside the string.)

**Fix.** Plain words in shader comments.

**Rule.** Never put backticks or `\${` inside shader strings held in
template literals.

## 8. `GPUBindGroupDescriptor.layout` is required

**Symptom.**
`Failed to execute 'createBindGroup' on 'GPUDevice': Failed to read the 'layout'
property from 'GPUBindGroupDescriptor': Required member is undefined.`

**Root cause.** The blit bind group was created with only `entries`. The
main scene pass passes `layout: this.pipeline.getBindGroupLayout(0)` — the
blit pass needed the same, from its *own* pipeline.

**Fix.** `layout: this.blitPipeline.getBindGroupLayout(0)`.

**Rule.** Every `createBindGroup` gets the layout of the pipeline that will
consume it — "auto" layouts are not usable before the pipeline exists, and
two pipelines do not share layouts implicitly.

## 9. `GPUTextureUsage` flags are per-role, and `TEXTURE_BINDING` is easy to forget

**Symptom.**
`[TextureView of Texture (1440x1080 px, BGRA8Unorm)] usage
(CopySrc|RenderAttachment) doesn't include TextureUsage::TextureBinding.`

**Root cause.** The supersampled intermediate was created with
`RENDER_ATTACHMENT | COPY_SRC`. It is bound into the blit shader as
`texture_2d<f32>` — that requires `TEXTURE_BINDING`. `COPY_SRC` was
unnecessary: nothing does a texel copy from it (see entry 4).

**Fix.** `usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING`.

**Rule — the role/flag table:**

| Texture | Role | Flags |
| --- | --- | --- |
| canvas | attachment via `GPUCanvasContext` | (implicit) |
| `msaaTexture` | 4-sample color attachment | `RENDER_ATTACHMENT` |
| `ssTexture` | resolve target + shader-sampled | `RENDER_ATTACHMENT \| TEXTURE_BINDING` |
| (hypothetical) | `copyTextureToTexture` source/dest | `COPY_SRC` / `COPY_DST` |

## 10. One bad object invalidates everything downstream

**Symptom.** After the WGSL parse error, the console showed a chain: invalid
ShaderModule → invalid RenderPipeline ("While validating vertex stage") →
invalid BindGroupLayout → `createBindGroup` failure → invalid encoder/
CommandBuffer → `submit` failure.

**Rule.** In WebGPU an object created from an invalid dependency inherits
"invalid due to a previous error". Always fix the *first* error in the
chain; the rest are echoes.

## 11. Demo: zoom must redraw unconditionally

**Symptom.** After wheel-zoom the canvas did not update until the mouse
happened to cross a line (hover change → `draw()`).

**Root cause.** The wheel handler was
`if (updateHover(...)) draw()` — it only redrew when the hover state changed.
Panning redrew every move; zooming did not.

**Fix.** `updateHover(...); draw()` — hover is still re-evaluated on every
wheel tick, but the redraw no longer depends on it.

## 12. WGSL struct layout: `f32` members pack back-to-back, no implicit gap after a `vec4f`

**Symptom.** The `worldWidth` flag had no effect on the GPU panel: every
stroke rendered at constant screen-pixel thickness regardless of zoom or of
the per-edge flag, while the SVG panel honored the same flag. No API error
anywhere — the scene simply drew with the wrong value.

**Root cause.** In `struct Edge` the members lay out as
`color: vec4f` (bytes 32–48), `width: f32` (48–52), `worldWidth: f32`
(52–56), `pad: f32` (56–60), struct size rounded up to 64. WGSL lays
`f32` members back-to-back with no implicit gap after a `vec4f` — implicit
padding only appears where a *larger* member alignment forces it (the old
`pad: vec2f` needed bytes 56–64 after `width` at 48). The JS packer assumed
`worldWidth` lived in a "pad float" slot (float 14, bytes 56–60), so the flag
was written into `pad` and the shader always read float 13 = 0.

**Fix.** Pack `worldWidth` at float index 13 (`out[o + 13]`) and document the
layout with explicit indices. The 16-float / 64-byte stride is unchanged.

**Rule.** When a JS packer mirrors a WGSL struct, derive byte offsets from the
alignment rules (`f32`: 4, `vec2f`: 8, `vec4f`: 16; struct size = max member
alignment, members placed at the smallest aligned offset ≥ previous end) —
never count pad floats by eye. A one-float offset produces no API error; the
scene renders with silently wrong values, so pin the exact float indices in
the packer unit test.

## Design notes (what the fix settled on)

- **`supersample: 1` is the exact legacy path.** One 4×MSAA texture, one
  resolve straight into the canvas, no intermediate, no second pass. Nothing
  in the default path changed from the plain-MSAA version.
- **Supersampling is opt-in.** Cost is `n²` pixels (at `n=2`: a 1440×1080
  4-sample MSAA texture + a 1440×1080 1-sample intermediate per frame on the
  720×540 canvas — trivial for a GPU, but it should not be forced on
  users).
- **It is a runtime switch, not a rebuild.** `setSupersample(n)` changes the
  factor; the offscreen textures are recreated lazily on the next `render()`
  (their size changed), and turning it *off* destroys the intermediate so no
  GPU memory lingers. The blit pipeline/sampler are created once in `init()`
  (one pipeline + one sampler — negligible) so switching needs no re-init and
  no canvas-context re-acquisition.
- **Blit UV mapping is 1:1** (`uv = (p+1)*0.5` with y as-is) because the scene
  shader outputs `-clip.y` (scene top = texture row 0). If the main shader's
  y-flip ever changes, the blit UV must change with it.
- **Sampler for the downscale:** `clamp-to-edge` on both axes, linear
  mag/min, no mips — exactly the filtering a canvas downscale wants.

## 13. WebGPU canvas alpha: `opaque` is the default, and a transparent clear renders black

**Symptom.** The canvas line layer in `apps/nodditor` (clear `[0, 0, 0, 0]`)
painted an opaque black rectangle instead of a transparent overlay over the
editor.

**Root cause.** `canvas.getContext('webgpu')` + `configure()` without an
`alphaMode` defaults to `opaque`: the browser composites the canvas as if
every pixel had alpha 1, so the clear value's alpha component is ignored and
`[0,0,0,0]` becomes black. The fragment shader also emitted straight
(un-premultiplied) colors, which would be wrong even on a transparent canvas.

**Fix.** `configure({ device, format, alphaMode: 'premultiplied' })`, and
premultiply the color by its alpha in the fragment shader
(`vec4f(c.rgb * c.a, c.a)`). The blit pass is a straight pass-through — the
premultiplied values stay premultiplied through the downscale.

**Rule.** A WebGPU canvas is opaque unless you ask for alpha. A canvas that
must let the page background show through needs `alphaMode: 'premultiplied'`,
and every color written to it — fragment output AND `clearValue`, which
WebGPU interprets as premultiplied — must be premultiplied by its own alpha.
