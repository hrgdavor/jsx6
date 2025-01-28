# signal implementation

For use with vanilla JS or JSX.

Priority is simpler implementation of the library, not going all the way for ease of use. Simplify debug versus adding guardrails so users don't shoot them selves in the foot.

Priority is also to propagate signal values immediately, to make use of stack trace for debugging. Performance improvements can be done before filling signals with values for critical code paths, and also after listenting to signal values (part of code that applies dom updates). 

# TC39 signals

Aim is to be compatible, and watch for practical ides from the proposal (team there explores differences and similarities in implementations ATM)

https://github.com/tc39/proposal-signals

It is actual proposal than aims to standardize signals, and allow easier migration and cosolidate conept.

It prefers signals that automatically find their dependencies during value evaluation. That is not implemented  here, as the library author is more comfortable with creating an explicit implementation.

## PERFORMANCE 

One simple performance improvement builtin from the start is value caching for each signal.

Another performance improvementt that will still keep proper stack trace is to collect listeners
during update to SignalBag and firing them after SignalBag updates are done. That would cause a derived signal
that creates `fullNname` using `$signal.firstName` and `$signal.lastName` to be updated only once. Going broader than this could be useful, but also counter productive if it breaks stack trace visibility of value propagation.

postponing value evaluation is one way to reduce changes, and increase performance

- priority is to evaluate immediately to simplify reasoning.
- batching is opt-in as it is an optimisation
- provide means to do batching for critical paths
