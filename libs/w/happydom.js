import { GlobalRegistrator } from '@happy-dom/global-registrator'

try {
  GlobalRegistrator.register()
} catch (e) {
  console.log('GlobalRegistrator.register', e)
}
