import fs from 'fs'

fs.readFile('README.md', 'utf8', function (error, data) {
  if (error) throw error
  var bumped = data.replace(
    /(!\[Version )(\d+\.\d+\.\d+)(\]\(https:\/\/img\.shields\.io\/badge\/version-)(\d+\.\d+\.\d+)(-gray\.svg\))/g,
    process.argv[2] || '$1',
  )
  fs.writeFile('README.md', bumped, function (error) {
    if (error) throw error
    console.log(process.argv[2] ? `Bumped readme file to ${process.argv[2]}` : `Version number not found.`)
  })
})
