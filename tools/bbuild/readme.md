# build utility to use with Bun

! NOTICE UNTIL!! Bun build covers most of esbuild bundling features esbuild is stil needed, but aim is to simplify the transition.
[status/esbuild comparison](https://bun.sh/docs/bundler/vs-esbuild) [roadmap](https://github.com/oven-sh/bun/issues/159)

This utility covers making scripts in the style I prefer. Node version of this
utility that I made initially had bunch of transitive dependencies. Bun version
will have zero additional transitional dependencies (when esbuild compat is ready), I can just use this utility
to make build scripts in my own preferred style.

# Opinion: Advanced tooling can be great, but at what cost ?

I really like Vite and admire their dev team, and I use it to quickly test things when I do not feel like using codepen.
For development and building I think one should strive to know how to develop, build deploy stuff
without such a monolithic(I still think great) tool. 

I mentioned Vite because that is the tool is known and popular and I use it also from time to time,
and there are more tools, and more will be created but the point is the same if you just use them
and do not know the basics behind them. There is a business model in providing such a convenience,
I just feel it is not worth being trapped. It is perfectly fine if you know how to do thse steps
with standalone tools, and use Vite or similar toold that hides stuff because you decided, not because you do not know how
to do it differently. Vite was likely written by devs that thought existing tools were not the right for them.

# VS something else

This utility is my exploration if I can setup productive tooling to do those things (dev/watch, build, deploy) for my projects.
This also means it will do only a small subset of things tools like Vite do, because the small subset is what I need.
Vite has a much broader audience, and that is the double-edged sword of any great library or framework,
they ARE great, but support so many different cases, the more time passes by, lesser is the percentage of
things useful to individual teams/developers, and it also become increasingly more difficult do deviate from the
main concept.

# Bun parseArgs

## strict:false

You can get a lot out of the `parseArgs` even without the config parameters. Just
make use of default handling of parameters along with some JavaScript spread tricks.



Here is more complex example how you can use `parseArgs` without config
and be able to use shorthands for booleans, have parameters with values and also 
the args that are not bound to any parameter in an array.

```js
import { parseArgs } from 'util'

function printHelp() {
  console.log(`This is a sample script
      --mode=     script mode of operation
-v    --verbose   verbose output
      --help      to get this help screen
`)
  process.exit(0)
}

const {
  values: { v, verbose: isVerbose = v, help, mode = 'default' },
  positionals: [bunPath, scriptPath, ...args],
} = parseArgs({ args: Bun.argv, strict: false })

if (help) printHelp()

if (isVerbose) {
  console.log('some verbose output')
  console.log('bunPath', bunPath)
  console.log('scriptPath', scriptPath)
}

console.log(`running script in ${mode} mode, and args:`, args)
```
