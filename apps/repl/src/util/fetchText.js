export const fetchText = (...args) => fetch(...args).then(resp => resp.text())
