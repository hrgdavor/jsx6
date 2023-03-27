import { copyTask } from './src/copyTask.js'

copyTask('src', 'build/1')
copyTask('src', 'build/2', { include: ['c*'] })
