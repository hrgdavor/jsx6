import { spawn } from 'child_process';
import { file, Glob } from 'bun';
import { join } from 'path';

const CONFIG_PATH = 'scripts/versions.json';

async function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')} (in ${cwd})`);
    const proc = spawn(command, args, { cwd, stdio: 'inherit', shell: true });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
}

async function getAllPackageVersions() {
  const versions = {};
  const glob = new Glob('**/package.json');
  const dirs = ['libs', 'apps', 'tools'];
  
  for (const dir of dirs) {
    for (const pkgPath of glob.scanSync({ cwd: dir })) {
      const fullPath = join(dir, pkgPath);
      try {
        const pkg = await file(fullPath).json();
        if (pkg.name) {
          versions[pkg.name] = pkg.version;
        }
      } catch (err) {
        // Skip invalid or unreadable package.json
      }
    }
  }
  return versions;
}

function resolveDeps(pkg, catalog, packageVersions) {
  let changed = false;
  const depTypes = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  for (const type of depTypes) {
    if (pkg[type]) {
      for (const [name, depVersion] of Object.entries(pkg[type])) {
        if (typeof depVersion !== 'string') continue;
        
        if (depVersion.startsWith('workspace:')) {
          const version = packageVersions[name];
          if (version) {
            console.log(`  - Updating ${type}: ${name} (${depVersion} -> ${version})`);
            pkg[type][name] = version;
            changed = true;
          } else {
            console.warn(`  - Warning: ${name} is a workspace dependency but version not found in monorepo`);
          }
        } else if (depVersion === 'catalog:') {
          const catalogVersion = catalog[name];
          if (catalogVersion) {
            console.log(`  - Updating ${type}: ${name} (catalog: -> ${catalogVersion})`);
            pkg[type][name] = catalogVersion;
            changed = true;
          } else {
            console.warn(`  - Warning: ${name} use catalog: but not found in root catalog`);
          }
        }
      }
    }
  }
  return changed;
}

async function prompt(question) {
  process.stdout.write(question);
  for await (const line of console) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase() === 'y' || trimmed.toLowerCase() === 'yes') return 'y';
    return trimmed;
  }
}

async function run() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const manualReplace = args.includes('--manual-replace');
  // Support both --public and --access public (npm style)
  const isPublic = args.includes('--public') || args.includes('public');
  
  // Filter out flags to get target packages
  const targetPackages = args.filter(a => !a.startsWith('--') && a !== 'public');

  const rootPkgFile = file('package.json');
  const rootPkg = await rootPkgFile.json();
  const catalog = rootPkg.catalog || {};
  
  const packageVersions = await getAllPackageVersions();

  const configFile = file(CONFIG_PATH);
  const config = (await configFile.exists()) ? await configFile.json() : { groups: { lockstep: [] } };
  
  let modulesToPublish = targetPackages;
  if (modulesToPublish.length === 0) {
    modulesToPublish = config.groups.lockstep || [];
    console.log('No specific packages targeted. Defaulting to lockstep group.');
  }

  if (modulesToPublish.length === 0) {
    console.error('No packages found to publish.');
    process.exit(1);
  }

  console.log('--- Phase 1: Validating all modules ---');
  for (const relPath of modulesToPublish) {
    console.log(`\nValidating: ${relPath}`);
    const pkgPath = join(relPath, 'package.json');
    const tsconfigPath = join(relPath, 'tsconfig.json');
    
    const pkgFile = file(pkgPath);
    if (!(await pkgFile.exists())) {
      console.error(`Package file not found: ${pkgPath}`);
      process.exit(1);
    }
    const pkg = await pkgFile.json();
    const scripts = pkg.scripts || {};

    try {
      // 1. Build if scripts exist
      if (scripts.build) {
        await runCommand('npm', ['run', 'build'], relPath);
      }
      if (scripts['build-cjs']) {
        await runCommand('npm', ['run', 'build-cjs'], relPath);
      }

      // 2. TSC if tsconfig exists
      if (await file(tsconfigPath).exists()) {
        await runCommand('bun', ['x', 'tsc'], relPath);
      }

      // 3. Test
      const glob = new Glob('**/*.test.js');
      let hasTests = false;
      for (const file of glob.scanSync({ cwd: relPath })) {
        hasTests = true;
        break;
      }

      if (hasTests) {
        await runCommand('bun', ['test'], relPath);
      } else {
        console.log(`No tests found in ${relPath}. Skipping.`);
      }
    } catch (err) {
      console.error(`\nValidation failed in ${relPath}. Aborting publish.`);
      process.exit(1);
    }
  }

  if (isDryRun) {
    console.log('\n--- Phase 2: Dry Run (Simulated Publishing) ---');
  } else {
    console.log('\n--- Phase 2: Publishing ---');
  }

  for (const relPath of modulesToPublish) {
    const pkgPath = join(relPath, 'package.json');
    const pkgFile = file(pkgPath);
    if (!(await pkgFile.exists())) {
      console.warn(`Package file not found: ${pkgPath}. Skipping.`);
      continue;
    }
    const pkg = await pkgFile.json();

    if (pkg.private) {
      console.log(`\nSkipping private module: ${relPath}`);
      continue;
    }

    const version = pkg.version;
    console.log(`\nPreparing to publish: ${relPath} (version: ${version})`);

    let success = false;
    let originalContent = null;
    let modified = false;

    try {
      const pkgContent = await pkgFile.text();
      const pkgJson = JSON.parse(pkgContent);

      let changed = false;
      if (manualReplace && resolveDeps(pkgJson, catalog, packageVersions)) {
        changed = true;
      }

      // Ensure public access for scoped packages
      if (isPublic) {
        pkgJson.publishConfig = pkgJson.publishConfig || {};
        if (pkgJson.publishConfig.access !== 'public') {
          pkgJson.publishConfig.access = 'public';
          changed = true;
          console.log(`  - Set publishConfig.access to public for ${relPath}`);
        }
      }

      if (changed) {
        if (!isDryRun) {
          modified = true;
          originalContent = pkgContent;
          await Bun.write(pkgPath, JSON.stringify(pkgJson, null, 2));
          console.log(`  - Updated ${pkgPath} for publishing`);
        } else {
          console.log(`  - [DRY RUN] Would update ${pkgPath} with resolved dependencies`);
        }
      }

      if (isDryRun) {
        console.log(`  - [DRY RUN] Would publish ${relPath} (version: ${version})`);
        success = true;
        continue;
      }

      while (!success) {
        const args = ['publish'];
        if (isPublic) {
          args.push('--access', 'public');
        }

        try {
          await runCommand('npm', args, relPath);
          success = true;
        } catch (err) {
          console.error(`\nPublish failed for ${relPath}.`);
          const choice = await prompt('Retry? (y/n, or empty to abort): ');
          if (choice === 'y') {
            console.log(`Retrying ${relPath}...`);
          } else {
            console.error('Manual intervention may be required for remaining modules.');
            process.exit(1);
          }
        }
      }
    } finally {
      if (!isDryRun && modified && originalContent) {
        await Bun.write(pkgPath, originalContent);
        console.log(`  - Restored original package.json for ${relPath}`);
      }
    }
  }

  if (isDryRun) {
    console.log('\nDry run completed. No changes made.');
  } else {
    console.log('\nAll targeted modules published successfully.');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
