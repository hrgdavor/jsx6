import { existsSync } from 'fs'

export const logBuildPlugin = output => ({
  name: 'buildTime',
  setup(build) {
    let buildStartTime
    build.onStart(() => {
      buildStartTime = Date.now()
    })
    build.onEnd(result => {
      if (!result.errors.length) {
        console.log('build finished in ' + (Date.now() - buildStartTime) + 'ms\t ' + (output || ''))
      }
    })
  },
})

export const runEsbuild = async (
  esbuild,
  { watch, dispose = true, skipExisting = false, ...esBuildOptions },
) => {
  if (!esBuildOptions.plugins) esBuildOptions.plugins = []
  esBuildOptions.plugins.push(logBuildPlugin(esBuildOptions.outfile))

  const ctx = await esbuild.context(esBuildOptions)

  if (!watch && !(skipExisting && esBuildOptions.outfile && existsSync(esBuildOptions.outfile)))
    await ctx.rebuild()

  if (watch) await ctx.watch()
  else if (dispose) ctx.dispose()

  return ctx
}
