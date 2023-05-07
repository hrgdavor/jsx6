import { runEsbuild } from '@jsx6/build'
import * as esbuild from 'esbuild'

export const esbDef = {
  tsconfig: `tsconfig-custom.json`,
  jsx: 'automatic',
  jsxImportSource: '@jsx6',
  format: 'esm',
  loader: { '.js': 'tsx', '.jsx': 'tsx' },
  bundle: true,
  minify: true,
  skipExisting: true,
  sourcemap: true,
}

export async function buildScript(src, to, file, options = {}) {
  let ctx = await runEsbuild(esbuild, {
    ...esbDef,
    ...options,
    entryPoints: [`${src}/${file}`],
    outdir: to,
  })
}
