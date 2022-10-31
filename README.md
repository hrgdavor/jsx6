# JSX6

A library that only needs support for JSX (can be built by puse esbuid) that changes DOM precisely and reactively.


## Useful standalone part of this library

https://github.com/hrgdavor/jsx6/tree/main/libs/dom-observer

Performance for multiple ResizeObserver and IntersectionObserver can degrade if a new observer is created for each listener case, but some can be reused and it has become clear that It is better to reuse them instead of creating new for each observed element.

## JSX intro

https://github.com/hrgdavor/jsx6/tree/main/libs/dom-observer 

It is an interactive tutorial about JSX that is also a good introduction to this library.

The tutorial is also an experiment on how to present tutorial information in an interactive way. The format used there is not suitable for all chapters, so it has already yielded an insight regarding different types of explanations that need a different presentation format. This also brings the question how to intuitively switch between different formats if used inside a single tutorial.


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


