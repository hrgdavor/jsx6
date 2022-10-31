### note
This could easily become obsolete if I find similarly simple way to do this with official builds. For now, I need this build.
I am starting to realise that unpkg removes this from cache realetively fast, because there are not many users/downloads. So When I open sites using this, first load can take tens of seconds.

# Pre-built Monaco editor with workers

![Version 0.34.100](https://img.shields.io/badge/version-0.34.100-blue)




Purpose of this repo is to be able to use Monaco editor in my projects without advanced tools.
Monaco is such big editor that I want to load it separately, and if I include it as a dependency
I then need to use advanced tooling or complicate my builds. 

I admire [Vite](https://vitejs.dev/) and it is my favourite tool at the moment because of ease of use. Having big libraries pre-built manually also makes Vite start faster. I love those advanced tools, as they do help a lot, but when possible I want to be able to do things without them. That way I am less dependent on the currently popular tools and can learn more.

Monaco editor can be easily built using esbuild, but to get it working properly,  the workers also need to be built as separate JS files. Monaco then needs to know where the workers are, to be able to run the web-workers.

To tell Monaco where worker's JS is for each language we need to declare globally `self.MonacoEnvironment` so when Monaco editor wants to start the worker it can ask where specific worker JS file is. We communicate this information using a global variable (using too many global variables is bad, but there are legitimate use-cases, and this one is).

```js
  self.MonacoEnvironment = { getWorkerUrl: (moduleId, label)=>{
    if(label === 'javascript') return 'ts.worker.js'
    // .....
  }}
```

Same worker bundle can handle multiple languages, so we usually will have a mapping similar to this

```js
const workerMap = {
  editorWorkerService: 'editor',
  css: 'css',
  html: 'html',
  json: 'json',
  typescript: 'ts',
  javascript: 'ts',
  less: 'css',
  scss: 'css',
  handlebars: 'html',
  razor: 'html',
}
```

The worker files are named by convention: `editor.worker.js`, `ts.worker.js`, `html.worker.js`, `css.worker.js`, `json.worker.js` so their urls can easily be generated.

# workers and CDN

Although you can simply use the main editor code from CDN by adding script tag to your html: 

```html
<script src="https://www.unpkg.com/@jsx6/editor-monaco@0.34.100/dist/index.js"></script>
```

it is not as simple as that with web workers. Trying to run worker from CDN on your page will cause a CORS error.

There is a neat trick that I learned about while preparing to use this pre-built Monaco via CDN. The trick was part of Monaco examples at some point and I found it by googling in some old commits. They removed it later on (not sure why).

To be able to run worker code from CDN you need to generate [data url](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs) with a script inside that tells Monaco where base is, and call `importScripts` inside the worker script. This way the worker is local (no CORS error) and then our small two-liner worker loads the external script ... and it works :).

```js
const workerBase = 'https://www.unpkg.com/@jsx6/editor-monaco@0.34.100/dist/'
self.MonacoEnvironment = { getWorkerUrl: (moduleId, label)=>{
  if(label === 'javascript'){
    const proxyCode = `self.MonacoEnvironment = { baseUrl: '${workerBase}'};
      importScripts('${workerBase}/ts.worker.js');`
        
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(proxyCode)}`
  } 
    // .....
}}
```

To streamline this and avoid too much copy/pasta `setPreBuiltWorkerBase` script is built-in and added to Monaco export.

Local copy of Monaco pre-built files [more details](monaco.local.md)
```html
<link rel="stylesheet" href="./monaco/index.css">
<script src="./monaco/index.js"></script>
<script>monaco.setPreBuiltWorkerBase('./monaco')</script>
```

Monaco pre-built files from CDN [more details](monaco.cdn.md)
```html
<link rel="stylesheet" href="https://www.unpkg.com/@jsx6/editor-monaco@0.34.100/dist/index.css">
<script src="https://www.unpkg.com/@jsx6/editor-monaco@0.34.100/dist/index.js"></script>
<script>monaco.setPreBuiltWorkerBase('https://www.unpkg.com/@jsx6/editor-monaco@0.34.100/dist', true)</script>
```

# versions
- [@jsx6/editor version] -> [monaco version]
- 0.34.100 -> [monaco/0.34.0] - with some internal patches
- 0.34.0 -> [monaco/0.34.0] - initial version
