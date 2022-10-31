# JSX6

A JSX library without a special compiler that changes DOM precisely and reactively.

- Very much alike to the code in this [video](https://www.youtube.com/watch?v=O6xtMrDEhcE&ab_channel=ReactFinland). 
- Uses functions and JavaScript Proxies to avoid the need for compiling.
- Only needs support for JSX in bundlers.

- Can be built by pure(full-speed) [esbuid](https://esbuild.github.io/) without any plugins. 

- Supports observables and promises out of the box (probably will also support signals)


## NON goals

WILL NOT sacrifice any functionality or even attempt to support server side rendering like Next.js or others. It is strictly for apps that are not crawled by search engines. I personally am convinced that those use cases only bring ugly compromises that I never needed in my JavaScript coding career that spans all the way to 1998.

## useful standalone part of JSX6

If more parts of `jsx6` will make sense as standalone libs this section will be updated.

https://github.com/hrgdavor/jsx6/tree/main/libs/dom-observer

Performance for multiple ResizeObserver and IntersectionObserver can degrade if a new observer is created for each listener case, but some can be reused and it has become clear that It is better to reuse them instead of creating new for each observed element.

## JSX in general intro

https://github.com/hrgdavor/jsx6/tree/main/libs/dom-observer 

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

