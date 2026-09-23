import { Glob, file } from 'bun'

const rootPkg = await file('package.json').json()
// Bun uses the singular `catalog` key (Rush used `catalogs.default`).
const catalog = rootPkg.catalog || {}
const catalogDeps = new Set(Object.keys(catalog))

const glob = new Glob('**/package.json')
let hasError = false

console.log('Checking dependency versions...')

for await (const path of glob.scan({ onlyFiles: true })) {
  if (path.includes('node_modules') || path === 'package.json') continue
  const pkg = await file(path).json()
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  }

  for (const [name, version] of Object.entries(allDeps)) {
    if (typeof version !== 'string') continue
    // Skip internal workspace dependencies
    if (version.startsWith('workspace:') || version.startsWith('file:')) continue

    if (!catalogDeps.has(name)) {
      // Not centralised in the root catalog; hardcoded versions are allowed here,
      // but they are reported so drift stays visible.
      if (!version.startsWith('catalog:') && !version.startsWith('npm:')) {
        console.log(`[INFO] ${path}: ${name}@${version} is not in the root catalog`)
      }
      continue
    }

    if (version !== 'catalog:' && version !== 'catalog:default') {
      process.stderr.write(
        `[UNMANAGED] ${path}: ${name}@${version} should use 'catalog:' (catalog pins ${catalog[name]})\n`,
      )
      hasError = true
    }
  }
}

if (hasError) {
  console.error('\nFound unmanaged dependencies that should be in catalog!')
  process.exit(1)
}
console.log('All dependencies are correctly managed.')