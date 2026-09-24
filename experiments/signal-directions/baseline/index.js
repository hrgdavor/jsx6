/**
 * Control direction: the **unmodified** `@jsx6/signal` package.
 *
 * This is not one of the six directions — it is the baseline every direction is compared against.
 * It resolves through the workspace link, so it always measures the real, currently-published code
 * and can never drift from it. If this direction fails a contract case, the case is wrong, not the
 * library.
 */

export * from '@jsx6/signal'

export const meta = {
  id: 'baseline',
  name: 'baseline — unmodified @jsx6/signal',
  backend: 'current eager core',
  capabilities: ['core'],
  deps: [],
  loc: 0,
  notes: 'the control: workspace link to libs/signal, never copied, never edited',
}
