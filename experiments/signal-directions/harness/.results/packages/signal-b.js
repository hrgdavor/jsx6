// libs/signal/src/observe.js
var subscribeSymbol = Symbol.for("signalSubscribe");
var triggerSymbol = Symbol.for("signalTrigger");
var observeNow = ($signal, callback) => observe($signal, callback, true);
var observe = ($signal, callback, trigger = false) => _observe($signal, callback, trigger, true);
function _observe(obj, callback, trigger = false, passValue = false) {
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
  if (trigger)
    callback(value);
  return unsubscribe;
}
var isObservable = (obj) => !!(obj && (obj[subscribeSymbol] || typeof obj.then === "function" || typeof obj.subscribe === "function"));

// libs/signal/src/track.js
var trackState = { collector: null };

// libs/signal/src/signal.js
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

// libs/signal/src/computed.js
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
var $C = (getValue, ...declaredDeps) => createComputed(getValue, { declaredDeps });
var $CE = (getValue, ...declaredDeps) => createComputed(getValue, { eager: true, declaredDeps });
var dispose = ($computed) => $computed?.dispose?.();

// libs/signal/src/state.js
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

// libs/signal/index.js
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

// experiments/signal-directions/harness/.results/packages/signal-b.entry.js
var $a = signal(0);
var $b = signal(1);
var $sum = $S(() => $a() + $b(), $a, $b);
var $filtered = $F((v) => v * 2, $a);
var $s = $State({ x: 1 });
var $fromState = $S(() => $s.x() * 2, $s);
mergeValue($s, { x: 2 });
observeNow($sum, () => {
});
observe($a, () => {
});
var out = [$sum(), $filtered(), $s.x(), $fromState()];
out.push($C(() => $a() + $b())());
out.push($CE(() => $s.x() * 2, $s)());
batch(() => {
  $s.x = 3;
});
dispose($C(() => $a()));
