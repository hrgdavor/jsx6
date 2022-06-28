// https://github.com/stacktracejs/stacktrace-gps
// https://github.com/stacktracejs/error-stack-parser

import { transform, availablePlugins } from "@babel/standalone";
import jsx_mi2 from "babel-plugin-jsx-simple";
import syntax_jsx from "babel-plugin-syntax-jsx";

console.log((availablePlugins["jsx-mi2"] = jsx_mi2));
console.log((availablePlugins["syntax-jsx"] = syntax_jsx));
console.log( 
  transform(
    `import { h, Jsx6, appendChild } from '@jsx6/jsx6';
     export const hello = <div>Hello {name}!</div>
     `,
    {
      retainLines: true,
      plugins: [
        "syntax-jsx",
        "jsx-mi2",
        "syntax-object-rest-spread"
      ],
      presets: ["env"]
    }
  ).code
);
