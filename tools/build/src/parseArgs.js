export const parseArgs = (alias = {}, argv) => {
  if (!argv) argv = process.argv.slice(2)
  let _rest = []
  let out = { _rest }
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i]
    let key
    let value = true
    if (arg.startsWith('--')) {
      key = arg.substring(2)
    } else if (arg[0] === '-') {
      key = arg.substring(1)
      if (key.length > 1) {
        for (let j = 0; j < key.length; j++) {
          let tmp = key[j]
          tmp = alias[tmp] || tmp
          out[tmp] = true
        }
        continue
      }
      key = alias[key] || key
    }
    if (key) {
      let idx = key.indexOf('=')
      if (idx !== -1) {
        value = numOrStr(key.substring(idx + 1))
        key = key.substring(0, idx)
      }
      out[key] = value
    } else {
      _rest.push(arg)
    }
  }
  return out
}

const numOrStr = num => {
  let tmp = Number(num)
  return Number.isNaN(tmp) ? num : tmp
}
