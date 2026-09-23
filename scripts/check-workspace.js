#!/usr/bin/env bun
/**
 * Workspace integrity check — the guard rail for the Rush → Bun migration
 * (see `plan/rush/README.md`, item R3).
 *
 * Rush's `rush install` refused to run against a foreign lockfile, so the invariant "this repository
 * has exactly one package manager" was enforced by the tool itself. Bun does not enforce it for you:
 * running `npm install` in a single package (or restoring a stray `rush.json`) is silently accepted
 * and only shows up later as an install that cannot be reproduced. This script makes that invariant
 * a gate step.
 *
 * Checks, all cheap file/manifest reads (no subprocesses):
 *   1. no Rush artifacts: `rush.json`, `common/config/rush/`, any `.rush` directory;
 *   2. no foreign lockfiles outside generated/ignored directories;
 *   3. no workspace package defines the Rush-era plural `catalogs` key;
 *   4. every internal dependency is exactly `workspace:*` (no semver ranges, no `*`);
 *   5. every package.json is valid JSON and declares a name/version.
 *
 * Run standalone with `bun run scripts/check-workspace.js`, or as part of `bun run check`.
 */
import { Glob } from 'bun'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'

const ROOT = resolve(import.meta.dir, '..')
process.chdir(ROOT)

/** Lockfiles belonging to package managers this repository does not use. */
const FOREIGN_LOCKFILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'shrinkwrap.json'])

/** Directories that are generated, cached or third-party: never inspected. */
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.history', '.tmp', 'coverage', 'dist', 'esm', 'cjs', 'build', 'build_dev',
  'docs',
])

/** Packages that are internal to this repository but are not named `@jsx6/...`. */
const INTERNAL_EXTRA = new Set(['eslint-plugin-jsx6'])

const errors = []
const warnings = []

function rel(p) {
  return p.replaceAll('\\', '/')
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/** Workspace package directories, expanded from the root `workspaces` globs. */
function packageDirs() {
  const rootPkg = readJson(join(ROOT, 'package.json'))
  const dirs = []
  for (const ws of rootPkg.workspaces || []) {
    const [base, pattern] = ws.split('/')
    if (pattern === '*') {
      const baseDir = join(ROOT, base)
      if (!existsSync(baseDir)) continue
      for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
        if (entry.isDirectory()) dirs.push(`${base}/${entry.name}`)
      }
    } else {
      dirs.push(ws)
    }
  }
  return dirs.filter(dir => existsSync(join(ROOT, dir, 'package.json')))
}

function isInternal(name) {
  return name.startsWith('@jsx6/') || INTERNAL_EXTRA.has(name)
}

/** 1 — Rush artifacts. `rush.json` and the `common/` scaffolding are the whole point of this script. */
function checkRushArtifacts() {
  if (existsSync(join(ROOT, 'rush.json'))) {
    errors.push('rush.json exists again — this is a Bun workspace; see plan/rush/README.md')
  }
  if (existsSync(join(ROOT, 'common', 'config', 'rush'))) {
    errors.push('common/config/rush/ exists again — Rush configuration has no place in this repository')
  }
  for (const dir of new Glob('**/.rush').scanSync({ onlyFiles: false })) {
    const path = rel(dir)
    if (path.split('/').some(segment => IGNORED_DIRS.has(segment))) continue
    errors.push(`${path}: leftover Rush temp/cache directory (deleted during the Bun migration)`)
  }
}

/** 2 — foreign lockfiles. Only `bun.lock` may exist. */
function checkForeignLockfiles() {
  for (const file of new Glob('**/{package-lock.json,pnpm-lock.yaml,yarn.lock,shrinkwrap.json}').scanSync({
    onlyFiles: true,
  })) {
    const path = rel(file)
    const segments = path.split('/')
    if (segments.some(segment => IGNORED_DIRS.has(segment))) continue
    if (FOREIGN_LOCKFILES.has(segments[segments.length - 1])) {
      errors.push(`${path}: foreign lockfile — \`bun.lock\` is the only authoritative lockfile`)
    }
  }
}

/** 3 + 4 + 5 — per-manifest checks. */
function checkManifests(dirs) {
  for (const dir of dirs) {
    const path = join(ROOT, dir, 'package.json')
    let pkg

    try {
      pkg = readJson(path)
    } catch (err) {
      errors.push(`${dir}/package.json: not valid JSON (${err.message})`)
      continue
    }

    const label = pkg.name || dir
    if (!pkg.name) errors.push(`${dir}/package.json: missing "name"`)
    if (!pkg.version) errors.push(`${dir}/package.json: missing "version"`)

    // 3 — the plural `catalogs` key is the Rush-era form; Bun reads the singular root `catalog`.
    if (pkg.catalogs) {
      errors.push(
        `${label}: defines the plural "catalogs" key — this repo uses Bun's singular root "catalog"`,
      )
    }

    // 4 — internal dependencies must resolve through the workspace protocol, never a version range.
    // `npm:<range>` is allowed: a couple of babel plugins are consumed as aliased registry packages.
    for (const type of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [name, version] of Object.entries(pkg[type] || {})) {
        if (!isInternal(name)) continue
        if (version === 'workspace:*') continue
        if (typeof version === 'string' && version.startsWith('npm:')) continue
        errors.push(
          `${label}: ${type}.${name} is "${version}" — internal packages must use "workspace:*"`,
        )
      }
    }
  }
}

/**
 * Reports which workspace packages depend on the same external package with a *different* resolved
 * version. This is the invariant Rush's `rush check` enforced (plan/rush/README.md, item R4): Bun's
 * catalog only centralizes what is listed in it, so drift between two manifests is otherwise silent.
 */
function checkVersionDrift(dirs) {
  const rootCatalog = readJson(join(ROOT, 'package.json')).catalog || {}
  /** @type {Map<string, Map<string, string[]>>} resolved version -> [sources] */
  const seen = new Map()

  for (const dir of dirs) {
    let pkg
    try {
      pkg = readJson(join(ROOT, dir, 'package.json'))
    } catch {
      continue
    }
    const label = pkg.name || dir

    for (const type of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [name, spec] of Object.entries(pkg[type] || {})) {
        if (typeof spec !== 'string') continue
        if (isInternal(name) || spec.startsWith('workspace:') || spec.startsWith('file:')) continue
        if (!spec.startsWith('catalog:') && !spec.startsWith('npm:')) {
          if (Object.keys(rootCatalog).length && !rootCatalog[name]) {
            warnings.push(`${label}: ${name}@${spec} is not in the root catalog (allowed, reported for visibility)`)
          }
        }

        // Resolve to the version that will actually be installed, so `catalog:` and a hardcoded
        // range that agree are not reported as drift.
        const resolved = spec.startsWith('catalog:') ? rootCatalog[name] : spec
        if (!resolved) continue
        if (!seen.has(name)) seen.set(name, new Map())
        const byVersion = seen.get(name)
        if (!byVersion.has(resolved)) byVersion.set(resolved, [])
        byVersion.get(resolved).push(`${label} (${type})`)
      }
    }
  }

  for (const [name, byVersion] of seen) {
    if (byVersion.size < 2) continue
    const detail = [...byVersion]
      .map(([version, sources]) => `${version} <- ${sources.join(', ')}`)
      .join(' | ')
    errors.push(`${name}: pinned to ${byVersion.size} different versions across the workspace: ${detail}`)
  }
}

const dirs = packageDirs()
if (!dirs.length) {
  console.error('No workspace packages found — is the root "workspaces" field intact?')
  process.exit(1)
}

console.log(`Checking workspace integrity (${dirs.length} package(s))...`)
checkRushArtifacts()
checkForeignLockfiles()
checkManifests(dirs)
checkVersionDrift(dirs)

for (const w of warnings) console.log(`[INFO] ${w}`)
for (const e of errors) console.error(`[error] ${e}`)

if (errors.length) {
  console.error(`\nWorkspace integrity check failed with ${errors.length} error(s).`)
  process.exit(1)
}
console.log('Workspace is a single Bun workspace: no Rush artifacts, one lockfile, no version drift.')
