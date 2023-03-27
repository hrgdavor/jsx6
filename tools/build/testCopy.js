import { copyTask } from './src/copyTask.js'

copyTask('src', 'deploy/1')
copyTask('src', 'deploy/2', { include: ['c*'] })
