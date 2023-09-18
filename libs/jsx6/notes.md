## tests

node builtin tests from node V18+ V16.17+ ( V18.0.0, V16.17.0)
https://github.com/paulmillr/chokidar dep

## jsx-runtime

https://github.com/reactjs/rfcs/blob/createlement-rfc/text/0000-create-element-changes.md

jsx functions need to move to package: `@jsx6/jsx-runtime` or rename `@jsx6/jsx6` to it
this also allows to have  `@jsx6/jsx-dev-runtime`

for esbuild, no need to define fragment and jsx tag, but define
- `--jsx=automatic` or JS: `jsx:automatic`
- `--jsx-import-source`, `jsxImportSource` — Overrides the root import for runtime functions (default "react") change to `@jsx6`
- `--jsx-dev` - to inject sour data

`export {jsx, jsx as jsxs, Fragment}`
- jsx function (tagName,attr)
  - children is not an argument but 
  - in dev mode more arge: isStaticChildren(like jsxs), source, _self
- jsxs - when <div>{a}{b}</div> to know ith is in template and not array that needs keys
  - this is react specifis and not needed, so we can export the same function for jsx and jsxs 
  - in dev it is a param isStaticChildren


## VSCODE OPEM
vscode://file/D:/path/to/file.js:line

## components and functional style
looks like in JS calling new on a function is not a problem if function returns value
in that case it acts like regular function

so, if function is tagname we can call new anyway, and that means we can support both regular components
and simple functions that return dom node taht will be inserted. Also we could add a pattern that returned
object if it is not a dom node can have a function that return the dom node upon calling the function.

this can allow reordering of component instantiation because it could be initialized on first time adding to DOM


##pitfalls 
 - tpl missing first parameter: h will cause issue because of missing parent
 - TODO throw an error that is more descriptive and/or make validation tool



mixin example and test
 - instanceof works for base class 
 - instanceof can not be tested for mixin class alone because it is created dynamically
 - super works as expected
 - vscode autocomplete can not be yet made to understand both (may not be needed anyway)


```js
    class Dog{
      getName(){
        return 'Dog'
      }
    }

    const mixinYellow = c=> class Yellow extends c{
      getName(){
        return 'Yellow ' + super.getName()
      }
      getColor(){
        return 'Yellow'
      }
    }

    function applyMixin(mixin, base){
      const out = mixin(base)
      out.mixinOf = base
      return out
    }

    let d1 = new Dog()
    console.log(d1.getName())
    const YellowDog = applyMixin(mixinYellow, Dog)
    /** @type { Dog } */
    let d2 = new YellowDog()
    console.log(d2.getName())
    console.log('mixinOf', YellowDog.mixinOf)
    console.log(d2.getColor(), '.getColor()')
    console.log(d2 instanceof Dog, 'd2 instanceof Dog')
    console.log(d2 instanceof YellowDog, 'd2 instanceof YellowDog')
```

```js
export function makeBinding(initialValue, propName, obj, alsoSetBindProp) {
  const updaters = []
  let value = initialValue

  function bindingFunc(v) {
    if (isFunc(v)) {
      return asBinding(() => v(value), obj, propName, updaters)
    }
    if (arguments.length) updateValue(value)
    return value
  }

  const binding = asBinding(bindingFunc, obj, propName, updaters)
  const updateValue = v => {
    if (v !== value) {
      value = v
      binding.dirty()
    }
  }

  if (obj) {
    Object.defineProperty(obj, propName, {
      get: () => value,
      set: updateValue,
    })
  }

  if (obj && alsoSetBindProp) obj['$' + propName] = bindingFunc

  return binding
}
```