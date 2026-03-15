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
    return line.trim();
  }
}

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  const configFile = file(CONFIG_PATH);
  if (!(await configFile.exists())) {
    console.error(`Config file not found: ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = await configFile.json();
  const lockstepModules = config.groups.lockstep || [];

  if (lockstepModules.length === 0) {
    console.error('No lockstep modules configured.');
    process.exit(1);
  }

  console.log('--- Phase 1: Validating all modules ---');
  for (const relPath of lockstepModules) {
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

  console.log('\n--- Phase 2: Publishing ---');
  if (isDryRun) {
    console.log('Dry run enabled. Skipping actual publish.');
    for (const relPath of lockstepModules) {
      console.log(`[DRY RUN] Would publish ${relPath}`);
    }
    return;
  }

  let otp = await prompt('Enter NPM OTP (press enter to skip if not needed): ');

  for (const relPath of lockstepModules) {
    let success = false;
    while (!success) {
      const args = ['publish', '--access', 'public'];
      if (otp) {
        args.push('--otp', otp);
      }
      
      try {
        await runCommand('npm', args, relPath);
        success = true;
      } catch (err) {
        console.error(`\nPublish failed for ${relPath}.`);
        const newOtp = await prompt('Retry with a new OTP? (enter new OTP, or empty to abort): ');
        if (newOtp) {
          otp = newOtp;
          console.log(`Retrying ${relPath} with new OTP...`);
        } else {
          console.error('Manual intervention may be required for remaining modules.');
          process.exit(1);
        }
      }
    }
  }

  console.log('\nAll modules published successfully.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
