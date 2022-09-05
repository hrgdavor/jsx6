import fs from 'fs'

fs.readFile('README.md', 'utf8', function (error, data) {
  if (error) throw error
  var bumped = data.replace(/(\d+\.\d+\.\d+)/g, process.argv[2] || '$1')
  fs.writeFile('README.md', bumped, function (error) {
    if (error) throw error
    console.log(process.argv[2] ? `Bumped readme file to ${process.argv[2]}` : `Version number not found.`)
  })
})
