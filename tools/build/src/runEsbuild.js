export const logBuildPlugin = {
  name: 'buildTime',
  setup(build) {
    let buildStartTime
    build.onStart(() => {
      buildStartTime = Date.now()
    })
    build.onEnd(result => {
      if (!result.errors.length) {
        console.log('build finished in ' + (Date.now() - buildStartTime) + 'ms')
      }
    })
  },
}

export const runEsbuild = async (esbuild, { watch, dispose = true, ...esBuildOptions }) => {
  if (!esBuildOptions.plugins) esBuildOptions.plugins = []
  esBuildOptions.plugins.push(logBuildPlugin)

  const ctx = await esbuild.context(esBuildOptions)

  await ctx.rebuild()

  if (watch) await ctx.watch()
  else if (dispose) ctx.dispose()

  return ctx
}
