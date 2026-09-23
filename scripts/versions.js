#!/usr/bin/env bun
/**
 * Version bumping — the replacement for Rush's version policies
 * (see plan/rush/README.md, item R7).
 *
 * `scripts/versions.json` records the two groups, and each standalone package's checked-in version:
 *
 *   groups.lockstep   packages that always share one version and are released together.
 *   standalone        packages versioned on their own, mapped to their current version.
 *
 * Usage:
 *   bun run bump                          show both groups and their versions
 *   bun run bump 1.8.19                   bump the lockstep group to 1.8.19
 *   bun run bump --pkg @jsx6/popover 1.0.2   bump one standalone package
 *   bun run bump --standalone 2.1.0       bump every standalone package to 2.1.0
 *
 * A bump updates `package.json`, keeps `jsr.json` in step (it carries its own `version` field and
 * nothing else rewrites it — plan/improvement-plan.md P1-8), and records the new version back into
 * `scripts/versions.json`. `scripts/check-manifests.js` fails when a standalone version in that file
 * disagrees with the package's own manifest, so the record cannot silently rot.
 */
import { file } from 'bun'
import { join } from 'path'

const CONFIG_PATH = 'scripts/versions.json'
const DOC_PATH = 'MODULE_VERSIONING.md'

async function readConfig() {
  const configFile = file(CONFIG_PATH)
  if (!(await configFile.exists())) {
    console.error(`Config file not found: ${CONFIG_PATH}`)
    process.exit(1)
  }
  return configFile.json()
}

async function writeConfig(config) {
  // Stable formatting: two-space indent and a trailing newline, so bumping does not churn the file.
  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')
}

/** Rewrites a package's version, and its jsr.json when it has one. */
async function bumpPackage(relPath, newVersion) {
  const pkgPath = join(relPath, 'package.json')
  const pkgFile = file(pkgPath)
  if (!(await pkgFile.exists())) {
    console.warn(`Warning: package.json not found at ${pkgPath}`)
    return null
  }

  const pkg = await pkgFile.json()
  const oldVersion = pkg.version
  if (oldVersion === newVersion) {
    console.log(`  ${pkg.name}: already at ${newVersion}`)
    return pkg.name
  }

  pkg.version = newVersion
  await Bun.write(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`  ${pkg.name}: ${oldVersion} -> ${newVersion}`)

  const jsrPath = join(relPath, 'jsr.json')
  const jsrFile = file(jsrPath)
  if (await jsrFile.exists()) {
    const jsr = await jsrFile.json()
    const jsrOld = jsr.version
    jsr.version = newVersion
    await Bun.write(jsrPath, JSON.stringify(jsr, null, 2) + '\n')
    console.log(`  ${jsrPath}: ${jsrOld} -> ${newVersion}`)
  }

  return pkg.name
}

/** The `Current Version: **x**` line in MODULE_VERSIONING.md describes the lockstep group only. */
async function updateVersioningDoc(newVersion) {
  const docFile = file(DOC_PATH)
  if (!(await docFile.exists())) return

  const docContent = await docFile.text()
  const versionRegex = /Current Version: \*\*(.*?)\*\*/
  if (versionRegex.test(docContent)) {
    await Bun.write(DOC_PATH, docContent.replace(versionRegex, `Current Version: **${newVersion}**`))
    console.log(`Updated ${DOC_PATH}`)
  } else {
    console.warn(`Warning: Could not find version string in ${DOC_PATH}`)
  }
}

/** Resolves the package directories this invocation targets. */
async function resolveTargets(config, args) {
  const pkgFlag = args.indexOf('--pkg')
  if (pkgFlag !== -1) {
    const name = args[pkgFlag + 1]
    if (!name) {
      console.error('--pkg needs a package name, for example: bun run bump --pkg @jsx6/popover 1.0.2')
      process.exit(1)
    }
    const standalone = config.standalone || {}
    const match = Object.keys(standalone).find(dir => dir.endsWith(name) || dir === name)
    if (!match) {
      console.error(`Unknown standalone package: ${name}`)
      console.error(`Known: ${Object.keys(standalone).join(', ')}`)
      process.exit(1)
    }
    return { kind: 'standalone', dirs: [match] }
  }

  if (args.includes('--standalone')) {
    return { kind: 'standalone', dirs: Object.keys(config.standalone || {}) }
  }

  return { kind: 'lockstep', dirs: config.groups?.lockstep || [] }
}

async function showCurrent(config) {
  const lockstep = config.groups?.lockstep || []
  if (lockstep.length) {
    const pkg = await file(join(lockstep[0], 'package.json')).json()
    console.log(`Current lockstep version: ${pkg.version} (${lockstep.length} package(s))`)
  } else {
    console.log('No lockstep modules configured.')
  }

  const standalone = Object.entries(config.standalone || {})
  if (standalone.length) {
    console.log('\nStandalone packages:')
    for (const [dir, version] of standalone) {
      console.log(`  ${version}  ${dir}`)
    }
  }

  console.log('\nTo bump run one of:')
  console.log(`  bun run bump <new-version>                  # lockstep group`)
  console.log(`  bun run bump --pkg <@scope/name> <version>  # one standalone package`)
  console.log(`  bun run bump --standalone <version>         # every standalone package`)
}

async function run() {
  const config = await readConfig()
  const args = process.argv.slice(2)

  // Positional arguments only: drop `--flags` and the value that `--pkg` consumes.
  const positionals = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--pkg') {
      i++ // skip the package name
      continue
    }
    if (!args[i].startsWith('--')) positionals.push(args[i])
  }
  const newVersion = positionals[0]

  if (!newVersion) {
    await showCurrent(config)
    return
  }

  const { kind, dirs } = await resolveTargets(config, args)
  if (!dirs.length) {
    console.error('No packages configured for that group.')
    process.exit(1)
  }

  console.log(`Bumping ${kind} package(s) to ${newVersion}...`)
  for (const dir of dirs) {
    await bumpPackage(dir, newVersion)
    if (kind === 'standalone') {
      config.standalone[dir] = newVersion
    }
  }

  if (kind === 'standalone') {
    await writeConfig(config)
    console.log(`Updated ${CONFIG_PATH}`)
  } else {
    await updateVersioningDoc(newVersion)
  }

  console.log('\nDone.')
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
