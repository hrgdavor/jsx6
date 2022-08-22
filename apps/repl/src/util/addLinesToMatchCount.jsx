import { countLines } from './countLines'

export function addLinesToMatchCount(referenceCode, codeToFix) {
  const count1 = countLines(referenceCode)
  const count2 = countLines(codeToFix)

  if (count1 > count2) {
    const arr = [codeToFix]
    for (let i = count2; i < count1; i++) arr.push('\n')
    codeToFix = arr.join('')
  }
  return codeToFix
}
