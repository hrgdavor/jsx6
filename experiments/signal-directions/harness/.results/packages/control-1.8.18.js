// experiments/signal-directions/baseline/signal/src/observe.js
var subscribeSymbol = Symbol.for("signalSubscribe");
var triggerSymbol = Symbol.for("signalTrigger");
var observeNow = ($signal, callback) => observe($signal, callback, true);
var observe = ($signal, callback, trigger = false) => _observe($signal, callback, trigger, true);
var subscribe = ($signal, callback, trigger = false) => _observe($signal, callback, trigger, false);
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

// experiments/signal-directions/baseline/signal/src/signal.js
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
    if (args.length === 0)
      return value;
    if (setValue(args[0])) {
      fireChanged();
      return true;
    }
  };
  Object.defineProperty($signal, ValueSymbol, { get: $signal });
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

// experiments/signal-directions/baseline/signal/src/state.js
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
  }
  function setValue(nv = {}) {
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
  specialProps.set("toJSON", getValue);
  specialProps.set(mergeValueSymbol, updateValue);
  specialProps.set(Symbol.toPrimitive, getValue);
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

// experiments/signal-directions/baseline/signal/index.js
var signalValue = ($signal) => typeof $signal === "function" ? $signal() : $signal;
function createDerivedSignal(signals, getValue) {
  const { $signal } = prepareSignal(getValue());
  const updater = () => $signal(getValue());
  signals.forEach((b) => subscribe(b, updater));
  return $signal;
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

// experiments/signal-directions/harness/.results/packages/control-1.8.18.entry.js
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
