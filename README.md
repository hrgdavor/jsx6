# JSX6  (apps only, no SSR, no web, no SEO).

For building SPA applications by leveraging JSX and signals. Not meant to hide or abstract the DOM, but actually have DOM smoothly integrated with the JS code.

- almost without a special requirements for bundler (Only needs support for JSX) 
- changes DOM precisely and reactively
- Implements signals as functions
- uses JavaScript Proxies for state(colelction of signals) 
- no need for special compiler for signals to work
- can be built by pure(full-speed no plugins) [esbuid](https://esbuild.github.io/)
- supports observables and promises out of the box 
- if there is a popular standalone signals lib will consider integrating 


## If you are doing SSR(Server side rendering) GTFO

Supporting SSR(Server Side Rendering) is actively ignored. Any compromises for using this lib combined with SSR are not welcome. 

This lib is strictly for JS APPLICATIOS that are not crawled by search engines. 

I do not want any ugly compromises to suport SSR (that I luckily never personally needed in my JavaScript apps).

## Useful standalone parts of JSX6

If more parts of `jsx6` will make sense as standalone libs this section will be updated.

https://github.com/hrgdavor/jsx6/tree/main/libs/dom-observer

Performance for multiple ResizeObserver and IntersectionObserver can degrade if a new observer is created for each listener case, but some can be reused and it has become clear that It is better to reuse them instead of creating new for each observed element.

## About JSX in general 

https://hrgdavor.github.io/jsx6/demistify/ 

It is an interactive tutorial about JSX that is also a good introduction to this library.

The tutorial is also an experiment on how to present tutorial information in an interactive way. The format used there is not suitable for all chapters, so it has already yielded an insight regarding different types of explanations that need a different presentation format. This also brings the question how to intuitively switch between different formats if used inside a single tutorial.

## JSX in JSX6 and the reactive updates to DOM

After the general intro into `JSX` another tutorial is needed to continue on the topic to explain how to handle dynamic content(how it works in `JSX6`).

## Development / contribution

Before you start you need these global modules
- `npm install -g pnpm` - https://pnpm.io/ - npm alternative
- `npm install -g @microsoft/rush` - https://rushjs.io/ - monorepo management
- `npm install -g vite` - https://vitejs.dev/ - project runner and bundler
- `npm install -g esbuild` - https://esbuild.github.io/ - superfast bundler compiler

The project is not initialized using `npm` like it may be usual. It is a monoremo of multiple sub-projects
so Rush was chosen to manage it.

After cloning the repository you need to initialize  project.

In the base dir of the project run `rush update`, and it will download dependencies using pnpm and link internal dependencies inside the monorepo.

