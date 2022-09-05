import fs from 'fs'

const version = process.argv[2] || '0.0.0'
const dryRun = process.argv[3] === 'dry'
const doReplace = (file, regexArr) => {
  if (file instanceof Array) {
    file.forEach(file => doReplace(file, regexArr))
    return
  }

  fs.readFile(file, 'utf8', function (error, data) {
    console.log('parsing for version info ', file)

    if (error) throw error

    let bumped = data

    regexArr.forEach(rule => {
      rule[1] = rule[1].replaceAll('[--VERSION--]', version)

      if (dryRun) {
        data.replace(rule[0], (...args) => {
          let replaced = args[0].replace(...rule)
          if (replaced === args[0]) replaced = '--UNCHANGED--'
          console.log(`\n${args[0]}\n${replaced}\n`)
        })
      } else {
        bumped = bumped.replace(...rule)
      }
    })

    if (dryRun) return

    fs.writeFile(file, bumped, function (error) {
      if (error) throw error
      if (bumped != data) {
        console.log(`${file} bumped to ${version}`)
      } else {
        console.log(`${file} version not updated`)
      }
    })
  })
}

const unpkgDepRule = [/(\@jsx6\/editor\-monaco\@)(\d+\.\d+\.\d+)(\/)/g, `$1[--VERSION--]$3`]

doReplace(
  ['README.md', 'monaco.cdn.md', 'monaco.local.md'],
  [
    unpkgDepRule,
    [
      /(!\[Version )(\d+\.\d+\.\d+)(\]\(https:\/\/img\.shields\.io\/badge\/version-)(\d+\.\d+\.\d+)(-blue\.svg\))/g,
      `$1[--VERSION--]$3[--VERSION--]$5`,
    ],
  ],
)
