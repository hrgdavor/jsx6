export function insertImports(mdParsed, providedMap = {}) {
  mdParsed.sections?.forEach(section => {
    section.lines?.forEach(line => {
      if (line.code !== undefined) {
        const importName = line.info?.import
        if (importName) {
          const provided = providedMap[importName]
          if (provided) {
            line.lines = line.lines.concat(provided.lines)
            line.info = { ...provided.info, ...line.info, hidden: line.info?.hidden }
            delete line.info.import
          } else {
            console.log('import not found', importName)
          }
        }
      }
    })
  })
}
