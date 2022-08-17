export function destroy(existing) {
  // TODO destroy component to release listeners or other things that might cause mem leaks
  // if dom node is reference, check the component that is bound to it
  existing?.destroy?.()
}
