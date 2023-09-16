const { readFileSync, writeFileSync, existsSync } = require('fs')

// console.log('process', process)

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

let rushFile = 'rush.json'
let basePath = ''
for (let i = 0; i < 10; i++) {
  if (!existsSync(basePath + rushFile)) basePath = '../' + basePath
}
let rush = readJson(basePath + rushFile)
let map = {}
rush.projects.forEach(({ versionPolicyName, packageName, projectFolder }) => {
  if (versionPolicyName === 'jsx6') {
    map[packageName] = { packageName, projectFolder }
  }
})
map['@jsx6/nodditor'] = { packageName: '@jsx6/nodditor', projectFolder: 'apps/nodditor' }
map['@jsx6/repl'] = { packageName: '@jsx6/repl', projectFolder: 'apps/repl' }

let version = process.argv[2] === 'w' ? 'workspace:*' : readPackage(basePath + 'libs/jsx6').version

if (process.argv[2] === 'p') {
  let pkg = readPackage('./')
  console.log('pkg.name', pkg.name)
  replaceallVersions(version, '.')
} else {
  for (let p in map) {
    //  if (p === '@jsx6/jsx6') continue
    let { projectFolder } = map[p]
    replaceallVersions(version, basePath + projectFolder)
  }
}

//replaceallVersions(version, 'apps/repl')
