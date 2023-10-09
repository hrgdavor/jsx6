import { addTranslations } from './core'

export const errTranslations = {
  JSX6E1: 'Tag is null',
  JSX6E2: 'Tag type is not supported',
  JSX6E3: 'Translation updater must be a function',
  JSX6E4: 'updater undefined',
  JSX6E5: 'dirty runner must be a function',
  JSX6E6:
    'If you are seeing this, you are using a binding function wrong\n - used $state instead state in template \n - called binding.toString()\nproperty that was used wrongly:',
  JSX6E7: 'Function required',
  JSX6E8: 'Parent required',
  JSX6E9: 'Event listener must be a function ',
  JSX6E10:
    'Context to assign references required, if you want to assign parts of the template to named props, please provide a scope by using domWithScope utility',
  JSX6E11: 'Update on state object can not be a primitive value',
  JSX6E12: 'Item not found',
  JSX6E13: 'Object not observable',
  JSX6E14: 'provided value must be an array',
  JSX6E15:
    'Multiple versions of jsx6 library are present, this will cause issues with JSX scope, please resolve the conflict by fo example running npm dedupe',
}

export const provideErrTranslations = () => addTranslations(errTranslations)
