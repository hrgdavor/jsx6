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
