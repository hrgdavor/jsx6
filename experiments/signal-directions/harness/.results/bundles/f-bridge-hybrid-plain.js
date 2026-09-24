var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../../libs/signal/src/observe.js
var subscribeSymbol = Symbol.for("signalSubscribe");
var triggerSymbol = Symbol.for("signalTrigger");
var observe = ($signal, callback, trigger2 = false) => _observe($signal, callback, trigger2, true);
var subscribe = ($signal, callback, trigger2 = false) => _observe($signal, callback, trigger2, false);
function _observe(obj, callback, trigger2 = false, passValue = false) {
  let bindingSub;
  let value;
  let unsubscribe;
  if (obj) {
    bindingSub = obj[subscribeSymbol];
    if (bindingSub) {
      if (callback) {
        const wrapped = passValue ? () => callback(obj()) : () => callback();
        unsubscribe = bindingSub(wrapped);
      }
      if (passValue)
        value = obj();
    } else {
      bindingSub = obj.then || obj.subscribe;
      if (bindingSub && callback) {
        const wrapped = passValue ? callback : () => callback();
        bindingSub.call(obj, wrapped);
      } else {
        if (passValue)
          value = obj;
      }
    }
  }
  if (trigger2)
    callback(value);
  return unsubscribe;
}
var isObservable = (obj) => !!(obj && (obj[subscribeSymbol] || typeof obj.then === "function" || typeof obj.subscribe === "function"));

// ../../libs/signal/src/track.js
var trackState = { collector: null };

// ../../libs/signal/src/signal.js
var ValueSymbol = Symbol.for("signalValue");
var noOp = function() {
};
function signal(value, name) {
  return prepareSignal(value, name).$signal;
}
function staticSignal(obj) {
  let $signal = () => obj;
  $signal[subscribeSymbol] = noOp;
  $signal[triggerSymbol] = noOp;
  $signal[Symbol.toPrimitive] = $signal.get = $signal;
  return $signal;
}
function prepareSignal(value, name) {
  const listeners = /* @__PURE__ */ new Set();
  function setValue(v) {
    if (v === value)
      return;
    value = v;
    return true;
  }
  const $signal = (...args) => {
    if (args.length === 0) {
      const collector = trackState.collector;
      if (collector !== null)
        collector.add($signal);
      return value;
    }
    if (setValue(args[0])) {
      fireChanged();
      return true;
    }
  };
  Object.defineProperty($signal, ValueSymbol, { get: $signal });
  Object.defineProperty($signal, "value", { get: $signal, configurable: true });
  if (name) {
    $signal.label = name;
    Object.defineProperty($signal, "name", { value: name });
  }
  const fireChanged = () => {
    listeners.forEach(runFuncNoArg);
  };
  $signal[subscribeSymbol] = (u) => {
    if (typeof u != "function")
      throw "listener must be a function";
    listeners.add(u);
    return () => listeners.delete(u);
  };
  $signal[triggerSymbol] = fireChanged;
  $signal[Symbol.toPrimitive] = $signal.get = () => value;
  return { $signal, fireChanged, listeners, setValue };
}
var runFuncNoArg = (f) => {
  try {
    f();
  } catch (e) {
    console.error(e, f);
  }
};

// ../../libs/signal/src/computed.js
var stateChildrenSymbol = Symbol.for("signalStateChildren");
var batchDepth = 0;
var pending = /* @__PURE__ */ new Set();
var batch = (fn) => {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0)
      flushPending();
  }
};
var flushPending = () => {
  let guard = 0;
  while (pending.size) {
    if (++guard > 1e3) {
      console.error("computed: possible dependency cycle, dropping pending recomputations", pending.size);
      pending.clear();
      return;
    }
    const items = [...pending];
    pending.clear();
    items.sort((a, b) => a.depth - b.depth);
    for (const item of items)
      item.settle();
  }
};
function createComputed(getValue, { eager = false, declaredDeps = [], name, collectDeps = declaredDeps.length ? "first" : "always" } = {}) {
  const internals = prepareSignal(void 0);
  const publish = internals.$signal;
  const listeners = internals.listeners;
  const depSubs = /* @__PURE__ */ new Map();
  const tracked = /* @__PURE__ */ new Set();
  const wanted = /* @__PURE__ */ new Set();
  const hasAggregateDep = declaredDeps.some((dep) => dep && dep[stateChildrenSymbol]);
  let dirty = true;
  let computing = false;
  let collected = false;
  let depth = 0;
  let cycleReported = false;
  const $computed = (...args) => {
    if (args.length)
      return void 0;
    if (dirty)
      recompute(false);
    return publish();
  };
  const invalidate = () => {
    dirty = true;
    if (batchDepth) {
      pending.add(node);
      return;
    }
    if (!eager && !listeners.size)
      return;
    recompute(true);
  };
  const buildWanted = () => {
    wanted.clear();
    for (const dep of tracked)
      wanted.add(dep);
    for (const dep of declaredDeps)
      if (dep && dep[subscribeSymbol])
        wanted.add(dep);
    for (const dep of declaredDeps) {
      const children = dep && dep[stateChildrenSymbol];
      if (!children)
        continue;
      for (const p in children)
        wanted.delete(children[p]);
    }
  };
  const wantedMatchesSubs = () => {
    if (wanted.size !== depSubs.size)
      return false;
    for (const dep of wanted)
      if (!depSubs.has(dep))
        return false;
    return true;
  };
  const depsAlreadySubscribed = () => {
    if (hasAggregateDep)
      return false;
    for (const dep of declaredDeps) {
      if (dep && dep[subscribeSymbol] && !depSubs.has(dep))
        return false;
    }
    if (tracked.size !== depSubs.size)
      return false;
    for (const dep of tracked)
      if (!depSubs.has(dep))
        return false;
    return true;
  };
  const syncDeps = () => {
    for (const [dep, unsubscribe] of [...depSubs]) {
      if (wanted.has(dep))
        continue;
      if (typeof unsubscribe === "function")
        unsubscribe();
      depSubs.delete(dep);
    }
    let maxDepth = 0;
    for (const dep of wanted) {
      if (!depSubs.has(dep))
        depSubs.set(dep, subscribeSafe(dep));
      const depDepth = dep.__depth;
      if (depDepth > maxDepth)
        maxDepth = depDepth;
    }
    depth = maxDepth + 1;
  };
  const subscribeSafe = (dep) => {
    try {
      return dep[subscribeSymbol](invalidate);
    } catch (e) {
      console.error(e, dep);
      return void 0;
    }
  };
  const recompute = (notify) => {
    if (computing) {
      if (!cycleReported) {
        cycleReported = true;
        console.error(
          `computed: ${name || "a computed signal"} was read while it was computing \u2014 cyclic dependency; returning the previous value`
        );
      }
      return false;
    }
    computing = true;
    const recollect = collectDeps === "always" || !collected;
    const prevCollector = trackState.collector;
    let next;
    if (recollect) {
      tracked.clear();
      trackState.collector = tracked;
    }
    try {
      next = getValue();
    } finally {
      if (recollect)
        trackState.collector = prevCollector;
      computing = false;
    }
    collected = true;
    if (recollect && !depsAlreadySubscribed()) {
      buildWanted();
      if (!wantedMatchesSubs())
        syncDeps();
    }
    dirty = false;
    const changed = internals.setValue(next) === true;
    if (changed && notify && listeners.size)
      internals.fireChanged();
    return changed;
  };
  const node = {
    get depth() {
      return depth;
    },
    settle() {
      if (!dirty)
        return;
      if (!eager && !listeners.size)
        return;
      recompute(true);
    }
  };
  const dispose2 = () => {
    for (const unsubscribe of depSubs.values())
      if (typeof unsubscribe === "function")
        unsubscribe();
    depSubs.clear();
    dirty = true;
  };
  $computed[subscribeSymbol] = (u) => {
    const unsubscribe = publish[subscribeSymbol](u);
    if (!collected || dirty)
      recompute(false);
    return unsubscribe;
  };
  $computed[triggerSymbol] = () => {
    dirty = true;
    node.settle();
  };
  $computed[Symbol.toPrimitive] = $computed.get = () => {
    if (dirty)
      recompute(false);
    return publish();
  };
  $computed.dispose = dispose2;
  $computed.__computed = true;
  Object.defineProperty($computed, "value", { get: $computed, configurable: true });
  Object.defineProperty($computed, "__depth", {
    get: () => depth,
    configurable: true
  });
  if (name) {
    $computed.label = name;
    Object.defineProperty($computed, "name", { value: name });
  }
  if (eager)
    node.settle();
  return $computed;
}

// ../../libs/signal/src/state.js
var mergeValueSymbol = Symbol.for("signalMergeValue");
function $State(initial) {
  let internals = {};
  let signals = {};
  let listeners = /* @__PURE__ */ new Set();
  const getSignal = (p, initialValue) => signals[p] || getInternal(p, initialValue).$signal;
  let batchLevel = 0;
  const fireChanged = () => {
    if (batchLevel > 0)
      return;
    listeners.forEach(runFuncNoArg);
  };
  for (let p in initial) {
    getSignal(p, initial[p]);
  }
  function getValue() {
    let out2 = {};
    for (let p in internals) {
      out2[p] = signals[p]();
    }
    return out2;
  }
  function updateValue(nv = {}, skipFire) {
    return batch(() => {
      let changed = false;
      batchLevel++;
      try {
        for (let p in nv) {
          if (getSignal(p)(nv[p]))
            changed = true;
        }
      } finally {
        batchLevel--;
      }
      if (!skipFire && changed)
        fireChanged();
      return changed;
    });
  }
  function setValue(nv = {}) {
    return batch(() => {
      batchLevel++;
      let changed = false;
      try {
        changed = updateValue(nv, true);
        for (let p in signals) {
          if (!(p in nv) && signals[p](void 0))
            changed = true;
        }
      } finally {
        batchLevel--;
      }
      if (changed)
        fireChanged();
      return changed;
    });
  }
  function getInternal(p, initialValue) {
    let internal = internals[p];
    if (!internal) {
      internal = internals[p] = prepareSignal(initialValue, p);
      internal.listeners.add(fireChanged);
      signals[p] = internal.$signal;
    }
    return internal;
  }
  let $state = function(...args) {
    if (!args.length)
      return getValue();
    return setValue(args[0]);
  };
  let specialProps = /* @__PURE__ */ new Map();
  specialProps.set(subscribeSymbol, (u) => {
    listeners.add(u);
    return () => listeners.delete(u);
  });
  specialProps.set(triggerSymbol, fireChanged);
  specialProps.set(stateChildrenSymbol, signals);
  specialProps.set("toJSON", getValue);
  specialProps.set(mergeValueSymbol, updateValue);
  specialProps.set(Symbol.toPrimitive, (hint) => hint === "number" ? NaN : JSON.stringify(getValue()));
  let statePproxy = new Proxy($state, {
    set: function(_, prop, value) {
      getSignal(prop)(value);
      return true;
    },
    get: function(_, prop) {
      let spec = specialProps.get(prop);
      return spec || getSignal(prop);
    }
  });
  return statePproxy;
}
function mergeValue($state, nv = {}) {
  return $state[mergeValueSymbol]?.(nv);
}

// ../../libs/signal/index.js
var signalValue = ($signal) => typeof $signal === "function" ? $signal() : $signal;
function createDerivedSignal(signals, getValue) {
  return createComputed(getValue, { eager: true, declaredDeps: signals });
}
function $S(template, ...signals) {
  if (!signals.length)
    return signal(template);
  if (template instanceof Array && /** @type {{raw?: any}} */
  template.raw) {
    template = callbackForTemplateString(template, signals);
  }
  return createDerivedSignal(signals, template);
}
function $F(filter, ...signals) {
  if (signals.length > 1 || isObservable(signals[0])) {
    return createDerivedSignal(signals, () => filter(...signals.map(signalValue)));
  } else {
    return staticSignal(signals[0]);
  }
}
var callbackForTemplateString = (arr, signals) => () => {
  let out2 = [arr[0]];
  for (let i = 1; i < arr.length; i++) {
    out2.push(signalValue(signals[i - 1]), arr[i]);
  }
  return out2.join("");
};

// vendor/alien-signals/index.mjs
var alien_signals_exports = {};
__export(alien_signals_exports, {
  computed: () => computed,
  effect: () => effect,
  effectScope: () => effectScope,
  endBatch: () => endBatch,
  getActiveSub: () => getActiveSub,
  getBatchDepth: () => getBatchDepth,
  isComputed: () => isComputed,
  isEffect: () => isEffect,
  isEffectScope: () => isEffectScope,
  isSignal: () => isSignal,
  setActiveSub: () => setActiveSub,
  signal: () => signal2,
  startBatch: () => startBatch,
  trigger: () => trigger
});

// vendor/alien-signals/system.mjs
function createReactiveSystem({ update, notify, unwatched }) {
  return {
    link: link2,
    unlink: unlink2,
    propagate: propagate2,
    checkDirty: checkDirty2,
    shallowPropagate: shallowPropagate2
  };
  function link2(dep, sub, version) {
    const prevDep = sub.depsTail;
    if (prevDep !== void 0 && prevDep.dep === dep) {
      return;
    }
    const nextDep = prevDep !== void 0 ? prevDep.nextDep : sub.deps;
    if (nextDep !== void 0 && nextDep.dep === dep) {
      nextDep.version = version;
      sub.depsTail = nextDep;
      return;
    }
    const prevSub = dep.subsTail;
    if (prevSub !== void 0 && prevSub.version === version && prevSub.sub === sub) {
      return;
    }
    const newLink = sub.depsTail = dep.subsTail = {
      version,
      dep,
      sub,
      prevDep,
      nextDep,
      prevSub,
      nextSub: void 0
    };
    if (nextDep !== void 0) {
      nextDep.prevDep = newLink;
    }
    if (prevDep !== void 0) {
      prevDep.nextDep = newLink;
    } else {
      sub.deps = newLink;
    }
    if (prevSub !== void 0) {
      prevSub.nextSub = newLink;
    } else {
      dep.subs = newLink;
    }
  }
  function unlink2(link3, sub = link3.sub) {
    const { dep, prevDep, nextDep, nextSub, prevSub } = link3;
    if (nextDep !== void 0) {
      nextDep.prevDep = prevDep;
    } else {
      sub.depsTail = prevDep;
    }
    if (prevDep !== void 0) {
      prevDep.nextDep = nextDep;
    } else {
      sub.deps = nextDep;
    }
    if (nextSub !== void 0) {
      nextSub.prevSub = prevSub;
    } else {
      dep.subsTail = prevSub;
    }
    if (prevSub !== void 0) {
      prevSub.nextSub = nextSub;
    } else if ((dep.subs = nextSub) === void 0) {
      unwatched(dep);
    }
    return nextDep;
  }
  function propagate2(link3, innerWrite) {
    let next = link3.nextSub;
    let stack;
    top:
      do {
        const sub = link3.sub;
        let flags = sub.flags;
        if (!(flags & (4 | 8 | 16 | 32))) {
          sub.flags = flags | 32;
          if (innerWrite) {
            sub.flags |= 8;
          }
        } else if (!(flags & (4 | 8))) {
          flags = 0;
        } else if (!(flags & 4)) {
          sub.flags = flags & ~8 | 32;
        } else if (!(flags & (16 | 32)) && isValidLink(link3, sub)) {
          sub.flags = flags | (8 | 32);
          flags &= 1;
        } else {
          flags = 0;
        }
        if (flags & 2) {
          notify(sub);
        }
        if (flags & 1) {
          const subSubs = sub.subs;
          if (subSubs !== void 0) {
            const nextSub = (link3 = subSubs).nextSub;
            if (nextSub !== void 0) {
              stack = { value: next, prev: stack };
              next = nextSub;
            }
            continue;
          }
        }
        if ((link3 = next) !== void 0) {
          next = link3.nextSub;
          continue;
        }
        while (stack !== void 0) {
          link3 = stack.value;
          stack = stack.prev;
          if (link3 !== void 0) {
            next = link3.nextSub;
            continue top;
          }
        }
        break;
      } while (true);
  }
  function checkDirty2(link3, sub) {
    let stack;
    let checkDepth = 0;
    let dirty = false;
    top:
      do {
        const dep = link3.dep;
        const flags = dep.flags;
        if (sub.flags & 16) {
          dirty = true;
        } else if ((flags & (1 | 16)) === (1 | 16)) {
          const subs = dep.subs;
          if (update(dep)) {
            if (subs.nextSub !== void 0) {
              shallowPropagate2(subs);
            }
            dirty = true;
          }
        } else if ((flags & (1 | 32)) === (1 | 32)) {
          stack = { value: link3, prev: stack };
          link3 = dep.deps;
          sub = dep;
          ++checkDepth;
          continue;
        }
        if (!dirty) {
          const nextDep = link3.nextDep;
          if (nextDep !== void 0) {
            link3 = nextDep;
            continue;
          }
        }
        while (checkDepth--) {
          link3 = stack.value;
          stack = stack.prev;
          if (dirty) {
            const subs = sub.subs;
            if (update(sub)) {
              if (subs.nextSub !== void 0) {
                shallowPropagate2(subs);
              }
              sub = link3.sub;
              continue;
            }
            dirty = false;
          } else {
            sub.flags &= ~32;
          }
          sub = link3.sub;
          const nextDep = link3.nextDep;
          if (nextDep !== void 0) {
            link3 = nextDep;
            continue top;
          }
        }
        return dirty && !!sub.flags;
      } while (true);
  }
  function shallowPropagate2(link3) {
    do {
      const sub = link3.sub;
      const flags = sub.flags;
      if ((flags & (32 | 16)) === 32) {
        sub.flags = flags | 16;
        if ((flags & (2 | 4)) === 2) {
          notify(sub);
        }
      }
    } while ((link3 = link3.nextSub) !== void 0);
  }
  function isValidLink(checkLink, sub) {
    let link3 = sub.depsTail;
    while (link3 !== void 0) {
      if (link3 === checkLink) {
        return true;
      }
      link3 = link3.prevDep;
    }
    return false;
  }
}

// vendor/alien-signals/index.mjs
var HasChildEffect = 64;
var cycle = 0;
var runDepth = 0;
var batchDepth2 = 0;
var notifyIndex = 0;
var queuedLength = 0;
var activeSub;
var queued = [];
var { link, unlink, propagate, checkDirty, shallowPropagate } = createReactiveSystem({
  update(node) {
    if ("getter" in node) {
      return updateComputed(node);
    }
    if ("currentValue" in node) {
      return updateSignal(node);
    }
    node.flags = 1;
    return true;
  },
  notify(effect2) {
    let insertIndex = queuedLength;
    let firstInsertedIndex = insertIndex;
    do {
      queued[insertIndex++] = effect2;
      effect2.flags &= ~2;
      effect2 = effect2.subs?.sub;
      if (effect2 === void 0 || !(effect2.flags & 2)) {
        break;
      }
    } while (true);
    queuedLength = insertIndex;
    while (firstInsertedIndex < --insertIndex) {
      const left = queued[firstInsertedIndex];
      queued[firstInsertedIndex++] = queued[insertIndex];
      queued[insertIndex] = left;
    }
  },
  unwatched(node) {
    if ("getter" in node) {
      if (node.depsTail !== void 0) {
        node.flags = 1 | 16;
        disposeAllDepsInReverse(node);
      }
    } else if ("currentValue" in node) {
    } else if ("fn" in node) {
      effectOper.call(node);
    } else {
      effectScopeOper.call(node);
    }
  }
});
function getActiveSub() {
  return activeSub;
}
function setActiveSub(sub) {
  const prevSub = activeSub;
  activeSub = sub;
  return prevSub;
}
function getBatchDepth() {
  return batchDepth2;
}
function startBatch() {
  ++batchDepth2;
}
function endBatch() {
  if (!--batchDepth2) {
    flush();
  }
}
function isSignal(fn) {
  return fn.name === "bound " + signalOper.name;
}
function isComputed(fn) {
  return fn.name === "bound " + computedOper.name;
}
function isEffect(fn) {
  return fn.name === "bound " + effectOper.name;
}
function isEffectScope(fn) {
  return fn.name === "bound " + effectScopeOper.name;
}
function signal2(initialValue) {
  return signalOper.bind({
    currentValue: initialValue,
    pendingValue: initialValue,
    subs: void 0,
    subsTail: void 0,
    flags: 1
  });
}
function computed(getter) {
  return computedOper.bind({
    value: void 0,
    subs: void 0,
    subsTail: void 0,
    deps: void 0,
    depsTail: void 0,
    flags: 0,
    getter
  });
}
function effect(fn) {
  const e = {
    fn,
    cleanup: void 0,
    subs: void 0,
    subsTail: void 0,
    deps: void 0,
    depsTail: void 0,
    flags: 2 | 4
  };
  const prevSub = setActiveSub(e);
  if (prevSub !== void 0) {
    link(e, prevSub, 0);
    prevSub.flags |= HasChildEffect;
  }
  try {
    ++runDepth;
    e.cleanup = e.fn();
  } finally {
    --runDepth;
    activeSub = prevSub;
    e.flags &= ~4;
  }
  return effectOper.bind(e);
}
function effectScope(fn) {
  const e = {
    deps: void 0,
    depsTail: void 0,
    subs: void 0,
    subsTail: void 0,
    flags: 1
  };
  const prevSub = setActiveSub(e);
  if (prevSub !== void 0) {
    link(e, prevSub, 0);
    prevSub.flags |= HasChildEffect;
  }
  try {
    fn();
  } finally {
    activeSub = prevSub;
  }
  return effectScopeOper.bind(e);
}
function trigger(fn) {
  const sub = {
    deps: void 0,
    depsTail: void 0,
    flags: 2
  };
  const prevSub = setActiveSub(sub);
  try {
    fn();
  } finally {
    activeSub = prevSub;
    sub.flags = 0;
    let link2 = sub.deps;
    while (link2 !== void 0) {
      const dep = link2.dep;
      link2 = unlink(link2, sub);
      const subs = dep.subs;
      if (subs !== void 0) {
        propagate(subs, !!runDepth);
        shallowPropagate(subs);
      }
    }
    if (!batchDepth2) {
      flush();
    }
  }
}
function updateComputed(c) {
  if (c.flags & HasChildEffect) {
    let link2 = c.depsTail;
    while (link2 !== void 0) {
      const prev = link2.prevDep;
      const dep = link2.dep;
      if (!("getter" in dep) && !("currentValue" in dep)) {
        unlink(link2, c);
      }
      link2 = prev;
    }
  }
  c.depsTail = void 0;
  c.flags = 1 | 4;
  const prevSub = setActiveSub(c);
  try {
    ++cycle;
    const oldValue = c.value;
    return oldValue !== (c.value = c.getter(oldValue));
  } finally {
    activeSub = prevSub;
    c.flags &= ~4;
    purgeDeps(c);
  }
}
function updateSignal(s) {
  s.flags = 1;
  return s.currentValue !== (s.currentValue = s.pendingValue);
}
function run(e) {
  const flags = e.flags;
  if (flags & 16 || flags & 32 && checkDirty(e.deps, e)) {
    if (flags & HasChildEffect) {
      let link2 = e.depsTail;
      while (link2 !== void 0) {
        const prev = link2.prevDep;
        const dep = link2.dep;
        if (!("getter" in dep) && !("currentValue" in dep)) {
          unlink(link2, e);
        }
        link2 = prev;
      }
    }
    if (e.cleanup) {
      runCleanup(e);
      if (!e.flags) {
        return;
      }
    }
    e.depsTail = void 0;
    e.flags = 2 | 4;
    const prevSub = setActiveSub(e);
    try {
      ++cycle;
      ++runDepth;
      e.cleanup = e.fn();
    } finally {
      --runDepth;
      activeSub = prevSub;
      e.flags &= ~4;
      purgeDeps(e);
    }
  } else if (e.deps !== void 0) {
    e.flags = 2 | flags & HasChildEffect;
  }
}
function flush() {
  try {
    while (notifyIndex < queuedLength) {
      const effect2 = queued[notifyIndex];
      queued[notifyIndex++] = void 0;
      run(effect2);
    }
  } finally {
    while (notifyIndex < queuedLength) {
      const effect2 = queued[notifyIndex];
      queued[notifyIndex++] = void 0;
      effect2.flags |= 2 | 8;
    }
    notifyIndex = 0;
    queuedLength = 0;
  }
}
function computedOper() {
  const flags = this.flags;
  if (flags & 16 || flags & 32 && (checkDirty(this.deps, this) || (this.flags = flags & ~32, false))) {
    if (updateComputed(this)) {
      const subs = this.subs;
      if (subs !== void 0) {
        shallowPropagate(subs);
      }
    }
  } else if (!flags) {
    this.flags = 1 | 4;
    const prevSub = setActiveSub(this);
    try {
      this.value = this.getter();
    } finally {
      activeSub = prevSub;
      this.flags &= ~4;
    }
  }
  const sub = activeSub;
  if (sub !== void 0) {
    link(this, sub, cycle);
  }
  return this.value;
}
function signalOper(...value) {
  if (value.length) {
    if (this.pendingValue !== (this.pendingValue = value[0])) {
      this.flags = 1 | 16;
      const subs = this.subs;
      if (subs !== void 0) {
        propagate(subs, !!runDepth);
        if (!batchDepth2) {
          flush();
        }
      }
    }
  } else {
    if (this.flags & 16) {
      if (updateSignal(this)) {
        const subs = this.subs;
        if (subs !== void 0) {
          shallowPropagate(subs);
        }
      }
    }
    const sub = activeSub;
    if (sub !== void 0) {
      link(this, sub, cycle);
    }
    return this.currentValue;
  }
}
function runCleanup(e) {
  const cleanup = e.cleanup;
  e.cleanup = void 0;
  const prevSub = activeSub;
  activeSub = void 0;
  try {
    cleanup();
  } finally {
    activeSub = prevSub;
  }
}
function effectOper() {
  effectScopeOper.call(this);
  if (this.cleanup) {
    runCleanup(this);
  }
}
function effectScopeOper() {
  this.flags = 0;
  disposeAllDepsInReverse(this);
  const sub = this.subs;
  if (sub !== void 0) {
    unlink(sub);
  }
}
function disposeAllDepsInReverse(sub) {
  let link2 = sub.depsTail;
  while (link2 !== void 0) {
    const prev = link2.prevDep;
    unlink(link2, sub);
    link2 = prev;
  }
}
function purgeDeps(sub) {
  const depsTail = sub.depsTail;
  let dep = depsTail !== void 0 ? depsTail.nextDep : sub.deps;
  while (dep !== void 0) {
    dep = unlink(dep, sub);
  }
}

// _shared/alien-compat.js
var subscribeSymbol2 = Symbol.for("signalSubscribe");
var triggerSymbol2 = Symbol.for("signalTrigger");
var alienSourceSymbol = Symbol.for("alienSource");
var isAlienSignal = (value) => typeof value === "function" && isSignal(value);
var isAlienComputed = (value) => typeof value === "function" && isComputed(value);
var isAlienNode = (value) => isAlienSignal(value) || isAlienComputed(value);
var isSignalLike = (value) => !!(value && value[subscribeSymbol2]);
var untracked = (fn) => {
  const prev = setActiveSub(void 0);
  try {
    return fn();
  } finally {
    setActiveSub(prev);
  }
};
var rootEffect = (fn) => {
  const prev = setActiveSub(void 0);
  try {
    return effect(fn);
  } finally {
    setActiveSub(prev);
  }
};
var instances = /* @__PURE__ */ new WeakMap();
function makeCompat(core) {
  const existing = instances.get(core.signal);
  if (existing)
    return existing;
  const bridges = /* @__PURE__ */ new WeakMap();
  const mirrors = /* @__PURE__ */ new WeakMap();
  function toAlien2($sig) {
    if (isAlienNode($sig))
      return $sig;
    if (!$sig || typeof $sig !== "function")
      return $sig;
    let bridged = bridges.get($sig);
    if (bridged)
      return bridged;
    const node = signal2(untracked(() => $sig()));
    const unsubscribe = $sig[subscribeSymbol2]?.(() => untracked(() => node($sig())));
    node[alienSourceSymbol] = $sig;
    node.dispose = () => {
      if (typeof unsubscribe === "function")
        unsubscribe();
      node.dispose = void 0;
      bridges.delete($sig);
    };
    bridges.set($sig, node);
    return node;
  }
  function toSignal2(node, name) {
    if (!isAlienNode(node))
      return node;
    let $mirror = mirrors.get(node);
    if ($mirror)
      return $mirror;
    $mirror = core.signal(void 0, name);
    $mirror.dispose = rootEffect(() => {
      $mirror(node());
      return void 0;
    });
    mirrors.set(node, $mirror);
    return $mirror;
  }
  const normalizeDeps = (deps) => deps.map((d) => isAlienNode(d) ? toSignal2(d) : d);
  function observeAlien(node, callback, trigger2, passValue) {
    if (!callback)
      return void 0;
    let first = true;
    return rootEffect(() => {
      const value = node();
      if (first) {
        first = false;
        if (trigger2) {
          if (passValue)
            callback(value);
          else
            callback();
        }
        return void 0;
      }
      if (passValue)
        callback(value);
      else
        callback();
      return void 0;
    });
  }
  const observe3 = (obj, callback, trigger2 = false) => isAlienNode(obj) ? observeAlien(obj, callback, trigger2, true) : core.observe(obj, callback, trigger2);
  const observeNow3 = (obj, callback) => observe3(obj, callback, true);
  const subscribe3 = (obj, callback, trigger2 = false) => isAlienNode(obj) ? observeAlien(obj, callback, trigger2, false) : core.subscribe(obj, callback, trigger2);
  const isObservable3 = (obj) => isAlienNode(obj) || core.isObservable(obj);
  const batch3 = (fn) => {
    startBatch();
    try {
      return fn();
    } finally {
      endBatch();
    }
  };
  const api = {
    alien: alien_signals_exports,
    isAlienSignal,
    isAlienComputed,
    isAlienNode,
    isSignalLike,
    toAlien: toAlien2,
    toSignal: toSignal2,
    normalizeDeps,
    observe: observe3,
    observeNow: observeNow3,
    subscribe: subscribe3,
    isObservable: isObservable3,
    batch: batch3,
    /** Stop a mirror created by `toSignal`, or tear down a bridge created by `toAlien`. */
    dispose: (node) => node?.dispose?.()
  };
  instances.set(core.signal, api);
  return api;
}

// _shared/derive-compat.js
var compat = makeCompat({ signal, observe, subscribe, isObservable });
var $S2 = (template, ...deps) => $S(template, ...compat.normalizeDeps(deps));
var $F2 = (filter, ...deps) => $F(filter, ...compat.normalizeDeps(deps));

// f-bridge-hybrid/index.js
var compat2 = makeCompat({
  signal,
  observe,
  subscribe,
  isObservable
});
var alien = compat2.alien;
var toAlien = compat2.toAlien;
var toSignal = compat2.toSignal;
var isAlienSignal2 = compat2.isAlienSignal;
var isAlienComputed2 = compat2.isAlienComputed;
var isAlienNode2 = compat2.isAlienNode;
var dispose = compat2.dispose;
var batch2 = compat2.batch;
var observe2 = compat2.observe;
var observeNow2 = compat2.observeNow;
var subscribe2 = compat2.subscribe;
var isObservable2 = compat2.isObservable;
function $C(fn, ...deps) {
  if (!deps.length)
    return compat2.alien.computed(() => fn());
  const nodes = deps.map((d) => compat2.toAlien(d));
  return compat2.alien.computed(() => fn(...nodes.map((n) => n())));
}

// harness/.results/bundles/f-bridge-hybrid-plain.js.entry.js
var $a = signal(0);
var $b = signal(1);
var $sum = $S2(() => $a() + $b(), $a, $b);
var $filtered = $F2((v) => v * 2, $a);
var $s = $State({ x: 1 });
var $fromState = $S2(() => $s.x() * 2, $s);
mergeValue($s, { x: 2 });
observeNow2($sum, () => {
});
observe2($a, () => {
});
globalThis.__size = [$sum(), $filtered(), $s.x(), $fromState(), isObservable2($sum)];
var out = [];
out.push($C((a, b) => a + b, $a, $b)());
dispose({});
globalThis.__size2 = out;
