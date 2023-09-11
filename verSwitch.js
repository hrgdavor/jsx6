const { readFileSync, writeFileSync } = require('fs')

function readJson(file) {
  let json = readFileSync(file).toString()
  return eval('(' + json + ')')
}
const readPackage = folder => readJson(folder + '/package.json')

function replaceVersion(package, version, str) {
  var reg = new RegExp('"' + package + '"[ : "]+([^"]+)"')
  return str.replace(reg, `"${package}": "${version}"`)
}

function replaceallVersions(version, folder) {
  let file = folder + '/package.json'
  let json = readFileSync(file).toString()
  let old = json
  for (let p in map) {
    json = replaceVersion(p, version, json)
  }
  if (json != old) console.log('CHANGED ' + file)
  writeFileSync(file, json)
}

let rush = readJson('rush.json')
let map = {}
rush.projects.forEach(({ versionPolicyName, packageName, projectFolder }) => {
  if (versionPolicyName === 'jsx6') {
    map[packageName] = { packageName, projectFolder }
  }
})
map['@jsx6/nodditor'] = { packageName: '@jsx6/nodditor', projectFolder: 'apps/nodditor' }
map['@jsx6/repl'] = { packageName: '@jsx6/repl', projectFolder: 'apps/repl' }
delete map['@jsx6/signal-dom']
delete map['@jsx6/signal-state']
delete map['@jsx6/signal']

let version = process.argv[2] === 'w' ? 'workspace:*' : '^' + readPackage('libs/jsx6').version

for (let p in map) {
  if (p === '@jsx6/jsx6') continue
  let { projectFolder } = map[p]
  replaceallVersions(version, projectFolder)
}

//replaceallVersions(version, 'apps/repl')
