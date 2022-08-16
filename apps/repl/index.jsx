// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser

import { appendChild, insertBefore, insertHtml } from '@jsx6/jsx6'
import { Editor } from './src/MonacoEditor'
import './main.css'

insertHtml(
  document.body,
  null,
  <b>
    Hello world.
    <div style="width: 400px; height:400px; border: solid 1px" class="fxs"></div>
  </b>,
)
