# TODO

# bug/missing

- trigger event in SignalBag when a child signal changes (works only when bag is updates with set of values)

to implement 
- [ ] filling a SignalBag vith many values where only few signals will be used 
  - could be implemented to store only values until signal is requested via proxy
  - make sure to still fire change event for the SignalBag even if only temp vals change
  - 
- [ ] sending single change event for listener that uses multiple values form SignalBag
- [ ] explore pausing dom changes when element is not visible 
  - tracking per element could be overkill, allow somehow tracking per larger component

# debugging

 - look for ways to include debug information to track how signal is composed, and when issues arise what caused it to misbehave
 - a flag to turn on/off debug information would be nice (runtime or build-time)

## signal reference (brainstorm)

It could be useful (but also error prone) to allow signal to be a kind of a proxy to be able to change source of value in the background. 
