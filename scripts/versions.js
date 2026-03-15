import { file, write } from 'bun';
import { join } from 'path';

const CONFIG_PATH = 'scripts/versions.json';
const DOC_PATH = 'MODULE_VERSIONING.md';

async function run() {
  const configFile = file(CONFIG_PATH);
  if (!(await configFile.exists())) {
    console.error(`Config file not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = await configFile.json();
  const newVersion = process.argv[2];

  if (!newVersion) {
    if (config.groups && config.groups.lockstep && config.groups.lockstep.length > 0) {
      const firstPkgPath = join(config.groups.lockstep[0], 'package.json');
      const pkg = await file(firstPkgPath).json();
      console.log(`Current lockstep version: ${pkg.version}`);
      console.log(`\nTo bump version run: bun ${process.argv[1]} <new-version>`);
    } else {
      console.log('No lockstep modules configured.');
    }
    return;
  }

  console.log(`Bumping lockstep modules to ${newVersion}...`);

  // Update lockstep modules
  const lockstepModules = config.groups.lockstep || [];
  for (const relPath of lockstepModules) {
    const pkgPath = join(relPath, 'package.json');
    const pkgFile = file(pkgPath);
    
    if (!(await pkgFile.exists())) {
      console.warn(`Warning: package.json not found at ${pkgPath}`);
      continue;
    }

    const pkg = await pkgFile.json();
    const oldVersion = pkg.version;
    pkg.version = newVersion;
    
    await write(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`  ${pkg.name}: ${oldVersion} -> ${newVersion}`);
  }

  // Update MODULE_VERSIONING.md
  const docFile = file(DOC_PATH);
  if (await docFile.exists()) {
    let docContent = await docFile.text();
    const versionRegex = /Current Version: \*\*(.*?)\*\*/;
    if (versionRegex.test(docContent)) {
      docContent = docContent.replace(versionRegex, `Current Version: **${newVersion}**`);
      await write(DOC_PATH, docContent);
      console.log(`Updated ${DOC_PATH}`);
    } else {
      console.warn(`Warning: Could not find version string in ${DOC_PATH}`);
    }
  }

  console.log('\nDone.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
