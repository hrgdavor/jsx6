export const countLines = str => {
  let length = 0
  for (let i = 0; i < str.length; ++i) {
    if (str[i] == '\n') {
      length++
    }
  }
  return length
}
