
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