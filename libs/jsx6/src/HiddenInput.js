/** Hidden input that is not limited to string values.
 * 
 * @returns 
 */
export const HiddenInput = (attr) => {
  let value
  let out = <input type="hidden" {...attr}/>
  out.getValue = () => value
  out.setValue = v => (out.value = value = v)
  return out
}
