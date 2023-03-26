export const fireCustom = (el, name, detail) => {
  el.dispatchEvent(new CustomEvent(name, { detail }))
}
