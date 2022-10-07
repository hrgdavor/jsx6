
# UI
 - add support for multiple files (main, imports, css)
 - css parser to skip applying css if invalid
 - apply css without refresh
 - allow for multiple blocks to combine into final script (code=initial|append)
   this way explanations can be done part by part (closer how live notebooks work)

# publishing

 - generate static html from the md file
 - embed info needed for running tutorial inside it
 - code blocks are needed to execute examples, and they can be colored when js takes over
 - the original html without JS should be readable and that also makes it ready for crawlers
 - links in headers should match live app version #something

```

sample formatting to use to format jsx

<h1 class="main">
  JSX - and excellent tooling support
</h1>

h("h1", { "class": "main" }, 
  "JSX - and excellent tooling support"
);//</h1>

``` 


# multiple JSX

- how to compile different JSX in singel project
- how to publish library that uses JSX to be able to inspect code, but not need JSX compiler in top level project (or have different JSX setup in top-level)
- with babel each folder can have own set of plugins
- how to do it with esbuild ?


# FlipFrame
- allow to wait switching iframes until code is executed (possible less flicker)
- also option to display that it is loading
- maybe also error display

# FinalizationRegistry 
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry

# unused
```js
/** To simplify, we just clear the element and add new nodes (no vnode diff is performed) */
export function applyHtml(parent, def, _self = this) {
  if (isStr(parent)) parent = document.getElementById(parent)

  function destroy(el) {
    let ch = el.firstElementChild
    while (ch) {
      destroy(ch)
      ch = ch.nextElementSibling
    }
    el?.component?.destroy()
  }
  destroy(parent)
  parent.innerHTML = ''
  insert(parent, def, null, _self)
}
```
