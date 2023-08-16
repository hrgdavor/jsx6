# JSX6  (apps only, no SSR).

Almost vanilla JS, focused on building applications by leveraging JSX and signals.

A JSX library without a special compiler that changes DOM precisely and reactively.

- Very much alike to the code in this [video](https://www.youtube.com/watch?v=O6xtMrDEhcE&ab_channel=ReactFinland). 
- Uses functions and JavaScript Proxies to avoid the need for compiling.
- Only needs support for JSX in bundlers.

- Can be built by pure(full-speed) [esbuid](https://esbuild.github.io/) without any plugins. 

- Supports observables and promises out of the box 

- if there is a popular standalone signals lib will consider integrating 


## WILL NOT

even attempt to support SSR(Server Side Rendering) or make compromises for using in websites. It is strictly for JS applications that are not crawled by search engines. Supporting or even slightly considering SSR can only bring ugly compromises that I luckily never personally needed in my JavaScript apps.

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

