#!/usr/bin/env bun
/**
 * Lockstep / targeted publishing — the replacement for `rush publish`
 * (see plan/rush/README.md, item R1).
 *
 * The publish step is `bun publish`, which resolves `workspace:*` and `catalog:` away at publish
 * time and packs the rewritten manifest. That matters for more than tidiness: the previous version
 * of this script rewrote `package.json` on disk, published with the npm CLI, then restored the
 * original — and needed `process.on('exit')` plus signal handlers to undo the rewrite if a run was
 * interrupted. None of that machinery exists any more, because nothing is rewritten on disk.
 *
 * What remains:
 *   Phase 1   — build (and test) every targeted module, so a broken module never reaches the registry.
 *   Phase 1b  — the full local verification gate with `--require-built`. There is no CI in this
 *               project (plan/improvement-plan.md D1), so the gate is the only line of defence and
 *               it must pass before anything is published.
 *   Phase 2   — `bun publish --access public` per module, with a retry prompt.
 *
 * Usage:
 *   bun pub                       publish the lockstep group (scripts/versions.json)
 *   bun pub libs/popover          publish specific module directories
 *   bun pub --dry-run             simulate, without publishing
 *   bun pub --no-gate             skip the local gate (emergencies only)
 */
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
  const skipGate = args.includes('--no-gate');
  // Support both --public and --access public (npm style).
  const isPublic = args.includes('--public') || args.includes('public');
  const tolerateRepublish = args.includes('--tolerate-republish');

  // Filter out flags to get target packages.
  const targetPackages = args.filter(a => !a.startsWith('--') && a !== 'public');

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
        await runCommand('bun', ['run', 'build'], relPath);
      }
      if (scripts['build-cjs']) {
        await runCommand('bun', ['run', 'build-cjs'], relPath);
      }

      // 2. TSC if tsconfig exists
      if (await file(tsconfigPath).exists()) {
        await runCommand('bun', ['x', 'tsc'], relPath);
      }

      // 3. Test
      const testGlob = new Glob('**/*.test.js');
      let hasTests = false;
      for (const _testFile of testGlob.scanSync({ cwd: relPath })) {
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

  // The local gate is the only gate this project has (no CI, see plan/improvement-plan.md D1),
  // so publishing refuses to continue unless it passes. It runs after the per-module builds
  // above so that --require-built can assert every declared entry point is really in the tarball.
  if (skipGate) {
    console.warn('\n--- Phase 1b: local verification gate SKIPPED (--no-gate) ---');
  } else {
    console.log('\n--- Phase 1b: local verification gate (bun run check --require-built) ---');
    try {
      await runCommand('bun', ['run', 'scripts/verify.js', '--require-built'], '.');
    } catch (err) {
      console.error('\nLocal verification gate failed. Aborting publish.');
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

    const publishArgs = ['publish'];
    if (isPublic) publishArgs.push('--access', 'public');
    if (tolerateRepublish) publishArgs.push('--tolerate-republish');
    if (isDryRun) publishArgs.push('--dry-run');

    let success = false;
    while (!success) {
      try {
        await runCommand('bun', publishArgs, relPath);
        success = true;
      } catch (err) {
        console.error(`\nPublish failed for ${relPath}.`);
        if (isDryRun) process.exit(1);
        const choice = await prompt('Retry? (y/n, or empty to abort): ');
        if (choice === 'y') {
          console.log(`Retrying ${relPath}...`);
        } else {
          console.error('Manual intervention may be required for remaining modules.');
          process.exit(1);
        }
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
