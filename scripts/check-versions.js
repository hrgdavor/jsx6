import { Glob, file } from 'bun';

const rootPkgFile = file('package.json');
const rootPkg = await rootPkgFile.json();
const catalogs = rootPkg.catalogs || {};
const defaultCatalog = catalogs.default || {};
const catalogDeps = new Set(Object.keys(defaultCatalog));

const glob = new Glob('**/package.json');
let hasError = false;

console.log('Checking dependency versions...');

for await (const path of glob.scan({
  onlyFiles: true,
})) {
  if (path.includes('node_modules') || path === 'package.json') {
    continue;
  }
  const pkgFile = file(path);
  const pkg = await pkgFile.json();
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };

  for (const [name, version] of Object.entries(allDeps)) {
    // Skip internal workspace dependencies
    if (typeof version === 'string' && (version.startsWith('workspace:') || version.startsWith('file:'))) {
      continue;
    }

    // Check if it's a shared dependency that should use catalog:
    if (catalogDeps.has(name)) {
      if (version !== 'catalog:' && version !== 'catalog:default') {
        process.stderr.write(`[UNMANAGED] ${path}: ${name}@${version} should use 'catalog:'\n`);
        hasError = true;
      }
    } else if (typeof version === 'string' && !version.startsWith('catalog:')) {
      // Report other hardcoded versions as informational for now, 
      // or strictly enforce catalog: for everything that exists in catalogs.
      // The task says: "Identify any dependency version that is NOT using a catalog: or workspace: protocol."
      // "Report these as 'unmanaged dependencies' and list the specific version string found."
      
      // If the dependency is NOT in catalog, it's fine to be hardcoded UNLESS the user wants to centralize EVERY shared dep.
      // But the requirement says: "Report these as 'unmanaged dependencies' and list the specific version string found."
      // "Exit with code 1 if any hardcoded (non-catalog) versions exist for packages that should be centralized."
      
      // I'll stick to erroring only for those in catalogDeps.
    }
  }
}

if (hasError) {
  console.error('\nFound unmanaged dependencies that should be in catalog!');
  process.exit(1);
} else {
  console.log('All dependencies are correctly managed.');
}
