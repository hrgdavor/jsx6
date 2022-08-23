import { readFileSync } from 'fs'

export default function CustomHmr() {
  return {
    name: 'custom-hmr',
    enforce: 'post',
    // HMR
    handleHotUpdate({ file, server }) {
      if (file.endsWith('.md')) {
        server.ws.send({
          type: 'custom',
          event: 'md-update',
          path: file,
          data: { file, content: readFileSync(file).toString() },
        })
      }
    },
  }
}
