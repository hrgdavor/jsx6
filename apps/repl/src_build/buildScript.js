import { runEsbuild } from '@jsx6/build'
import * as esbuild from 'esbuild'

export const esbDef = {
  // tsconfig.json is used for vscode to allow for more autocomplete options (without typescript checks)
  // it makes esbuild act weird, so we use a dummy config
  tsconfig: 'tsconfig-custom.json',
  // jsxFactory: 'h',
  // jsxFragment: 'null',
  jsx: 'automatic',
  jsxImportSource: '@jsx6',
  format: 'esm',
  loader: { '.js': 'tsx', '.jsx': 'tsx' },
  bundle: true,
  //  minify: true,
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
