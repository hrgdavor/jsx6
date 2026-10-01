// ../../libs/jsx6/src/errorCodes.js
var JSX6E1_NULL_TAG = 1;
var JSX6E2_UNSUPPORTED_TAG = 2;
var JSX6E7_REQUIRE_FUNC = 7;
var JSX6E8_REQUIRE_PARENT = 8;
var JSX6E9_LISTENER_MUST_BE_FUNC = 9;
var JSX6E10_CONTEXT_REQUIRED = 10;
var JSX6E15_MULTIPLE_VERSIONS = 15;

// ../../libs/jsx6/src/core.js
var TRANS = {};
var Group = class {
  constructor(obj) {
    for (let p in obj)
      this[p] = obj[p];
  }
};
function t(code, ...rest) {
  if (code instanceof Array) {
    if (rest.length) {
      const tmp = [code[0]];
      for (let i = 1; i < code.length; i++) {
        tmp.push(rest[i - 1]);
        tmp.push(code[i]);
      }
      code = tmp;
    }
    code = code.join("");
  }
  return TRANS[code] || code;
}
var errorMessage = (c) => t(errCode(c));
var throwErr = (c, ...info) => {
  const code = errCode(c);
  let msg = t(code);
  if (msg != code)
    msg = code + " " + msg;
  console.error(msg, ...info);
  throw new Error(msg);
};
var isFunc = (f) => typeof f === "function";
var isStr = (s) => typeof s === "string";
var isObj = (o) => typeof o === "object";
var isArray = (a) => a instanceof Array;
var isNode = (obj) => obj?.nodeType !== void 0;
var requireFunc = (func, err = JSX6E7_REQUIRE_FUNC) => {
  if (!func || !isFunc(func)) {
    throwErr(err, { func });
  }
  return func;
};
var runFuncNoArg = (f) => {
  try {
    f();
  } catch (e) {
    console.error(e, f);
  }
};
var errCode = (c) => "JSX6E" + c;

// ../../libs/jsx6/src/toDomNode.js
function toDomNode(n) {
  return !n || isNode(n) ? n : n.el || n;
}

// ../../libs/jsx6/src/addClass.js
function addClass(node, add) {
  node = toDomNode(node) || {};
  let cl = node.classList;
  if (cl) {
    if (add.includes(" "))
      add = /** @type {String} */
      add.split(" ");
    if (isArray(add))
      add.forEach((c) => cl.add(c));
    else
      cl.add(add);
  } else if (isObj(node)) {
    cl = node["class"] || "";
    node["class"] = cl ? cl + " " + add : add;
  }
  return node;
}

// ../../libs/jsx6/src/classIf.js
function classIf(node, cname, bool) {
  node = toDomNode(node);
  const cl = node.classList;
  if (bool) {
    cl.add(cname);
  } else {
    cl.remove(cname);
  }
}

// ../../libs/signal/src/observe.js
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

// ../../libs/signal/src/track.js
var trackState = (
  /** @type {{ collector: Set<Function> | null }} */
  { collector: null }
);

// ../../libs/signal/src/trace.js
var signalsTraced = false;
var traceOptions = {
  /** Capture a creation site per signal. This is the expensive part of an enabled session. */
  origin: true,
  /** Attach the listener set, so a debugger can answer "what depends on this". */
  listeners: true
};
var metaSymbol = Symbol.for("signalMeta");
var mergeValueSymbol = Symbol.for("signalMergeValue");
var LIBRARY_FILES = /[\\/](?:signal|computed|state|track|observe|debug|trace|trace-signal)\.js:\d+:\d+\)?$/;
var markFile = (() => {
  try {
    return String(new Error().stack).split("\n")[1]?.match(/\(?([^()\s]+?):\d+:\d+\)?$/)?.[1] || "";
  } catch {
    return "";
  }
})();
var lineFile = (line) => line.match(/\(?([^()\s]+?):\d+:\d+\)?$/)?.[1] || "";
var isInternal = (line) => {
  if (!line || line.includes("new Error"))
    return true;
  if (markFile && line.includes(markFile))
    return true;
  return LIBRARY_FILES.test(line);
};
var siteOfLine = (line, raw) => {
  const m = line.match(/\(?([^()\s]+?):(\d+):(\d+)\)?$/);
  if (!m)
    return null;
  return { text: `${m[1]}:${m[2]}:${m[3]}`, file: m[1], line: +m[2], column: +m[3], raw };
};
var extraInternal = [];
var captureFrom = (raw, skip = 0) => {
  const stack = String(raw || "");
  const lines = stack.split("\n").slice(1 + skip);
  for (const line of lines) {
    if (isInternal(line))
      continue;
    let own = false;
    for (const file of extraInternal) {
      if (line.includes(file)) {
        own = true;
        break;
      }
    }
    if (own)
      continue;
    const site = siteOfLine(line, stack);
    if (site)
      return site;
  }
  for (const line of lines) {
    if (!line || line.includes("new Error"))
      continue;
    if (markFile && lineFile(line) === markFile)
      continue;
    const site = siteOfLine(line, stack);
    if (site)
      return site;
  }
  return { text: "", file: "", line: 0, column: 0, raw: stack };
};
var isComputed = ($signal) => Boolean(
  /** @type {any} */
  $signal?.__computed
);
var attachTrace = ($signal, info = {}) => {
  if (!signalsTraced || !$signal)
    return void 0;
  const record = {
    signal: $signal,
    kind: info.kind || (isComputed($signal) ? "computed" : "signal"),
    origin: info.origin && traceOptions.origin ? typeof info.origin === "object" ? info.origin : captureFrom(new Error().stack) : null,
    listeners: traceOptions.listeners ? info.listeners || null : null,
    getter: info.getter || null,
    deps: info.deps || null
  };
  Object.defineProperty($signal, metaSymbol, { value: record, configurable: true });
  return record;
};

// ../../libs/signal/src/signal.js
var ValueSymbol = Symbol.for("signalValue");
var noOp = function() {
};
function staticSignal(obj) {
  let $signal = () => obj;
  $signal[subscribeSymbol] = noOp;
  $signal[triggerSymbol] = noOp;
  $signal[Symbol.toPrimitive] = $signal.get = $signal;
  return $signal;
}
function prepareSignal(value, name) {
  const listeners = /* @__PURE__ */ new Set();
  const origin = name && signalsTraced ? captureFrom(new Error().stack) : null;
  function setValue2(v) {
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
    if (setValue2(args[0])) {
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
    listeners.forEach(runFuncNoArg2);
  };
  $signal[subscribeSymbol] = (u) => {
    if (typeof u != "function")
      throw "listener must be a function";
    listeners.add(u);
    return () => listeners.delete(u);
  };
  $signal[triggerSymbol] = fireChanged;
  $signal[Symbol.toPrimitive] = $signal.get = () => value;
  if (origin)
    attachTrace($signal, { kind: "signal", listeners, origin });
  return { $signal, fireChanged, listeners, setValue: setValue2 };
}
var runFuncNoArg2 = (f) => {
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
function createComputed(getValue2, { eager = false, declaredDeps = [], name, collectDeps = declaredDeps.length ? "first" : "always" } = {}) {
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
      next = getValue2();
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
  const dispose = () => {
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
  $computed.dispose = dispose;
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
  if (signalsTraced) {
    attachTrace($computed, {
      kind: "computed",
      origin: captureFrom(new Error().stack),
      listeners,
      getter: getValue2,
      deps: () => ({ tracked: [...tracked], declared: declaredDeps })
    });
  }
  if (eager)
    node.settle();
  return $computed;
}

// ../../libs/signal/src/state-write-observer.js
var stateWriteObservers = null;
var hasStateWriteObservers = () => stateWriteObservers !== null;
var notifyStateWrite = (child, value) => {
  if (stateWriteObservers === null)
    return;
  for (const observer of [...stateWriteObservers]) {
    try {
      observer(child, value);
    } catch (e) {
      console.error(e, observer);
    }
  }
};

// ../../libs/signal/src/state.js
var mergeValueSymbol2 = Symbol.for("signalMergeValue");
function $State(initial) {
  let internals = {};
  let signals = {};
  let listeners = /* @__PURE__ */ new Set();
  const getSignal = (p, initialValue) => signals[p] || getInternal(p, initialValue).$signal;
  let batchLevel = 0;
  const fireChanged = () => {
    if (batchLevel > 0)
      return;
    listeners.forEach(runFuncNoArg2);
  };
  for (let p in initial) {
    getSignal(p, initial[p]);
  }
  function getValue2() {
    let out = {};
    for (let p in internals) {
      out[p] = signals[p]();
    }
    return out;
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
  function setValue2(nv = {}) {
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
      return getValue2();
    return setValue2(args[0]);
  };
  let specialProps = /* @__PURE__ */ new Map();
  specialProps.set(subscribeSymbol, (u) => {
    listeners.add(u);
    return () => listeners.delete(u);
  });
  specialProps.set(triggerSymbol, fireChanged);
  specialProps.set(stateChildrenSymbol, signals);
  specialProps.set("toJSON", getValue2);
  specialProps.set(mergeValueSymbol2, updateValue);
  specialProps.set(Symbol.toPrimitive, (hint) => hint === "number" ? NaN : JSON.stringify(getValue2()));
  let statePproxy = new Proxy($state, {
    set: function(_, prop, value) {
      const child = getSignal(prop);
      if (hasStateWriteObservers() && !Object.is(child(), value))
        notifyStateWrite(child, value);
      child(value);
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
  return $state[mergeValueSymbol2]?.(nv);
}

// ../../libs/signal/index.js
var signalValue = ($signal) => typeof $signal === "function" ? $signal() : $signal;
function createDerivedSignal(signals, getValue2) {
  return createComputed(getValue2, { eager: true, declaredDeps: signals });
}
function $F(filter, ...signals) {
  if (signals.length > 1 || isObservable(signals[0])) {
    return createDerivedSignal(signals, () => filter(...signals.map(signalValue)));
  } else {
    return staticSignal(signals[0]);
  }
}
var $Or = ($sa, $sb) => $F((a, b) => a || b, $sa, $sb);

// ../../libs/signal-dom/index.js
var anim = (func) => func();
if (typeof document !== "undefined") {
  anim = window.requestAnimationFrame.bind(window);
}
var isNode2 = (obj) => obj?.nodeType !== void 0;
function setAttribute(node, attrName, newValue) {
  if (newValue === false || newValue === void 0)
    newValue = null;
  if (newValue === true)
    newValue = attrName;
  if (!isNode2(node) && isNode2(node?.el))
    node = node.el;
  if (node.getAttribute(attrName) !== newValue) {
    if (newValue === null) {
      node.removeAttribute(attrName);
    } else {
      node.setAttribute(attrName, newValue);
    }
  }
}

// ../../libs/jsx6/src/mapProp.js
function mapProp(obj, callback, asArray) {
  if (obj) {
    if (isArray(obj)) {
      return obj.map(callback);
    } else if (isObj(obj)) {
      const out = asArray ? [] : {};
      if (asArray) {
        for (const p in obj) {
          out.push(callback(obj[p], p, obj));
        }
      } else {
        for (const p in obj) {
          out[p] = callback(obj[p], p, obj);
        }
      }
      return out;
    }
  }
}

// ../../libs/jsx6/src/setValue.js
var setValueFilterSymbol = Symbol.for("setValueFilterSymbol");
function applySetValueFilter(value, source) {
  let filter = source[setValueFilterSymbol];
  return filter ? filter(value) : value;
}
function setValue(obj, value) {
  if (obj === null || obj === void 0)
    return;
  value = applySetValueFilter(value, obj);
  if (isFunc(obj.setValue))
    return obj.setValue(value);
  if (isFunc(obj))
    return setValue(obj(), value);
  if (isNode(obj)) {
    if (value === void 0 || value === null)
      value = "";
    if (obj.tagName === "INPUT" && obj.type === "checkbox") {
      obj.checked = value;
    } else {
      obj.value = value;
    }
  } else {
    value = value || {};
    mapProp(obj, (o, p) => {
      if (o)
        setValue(o, value[p]);
    });
  }
}

// ../../libs/jsx6/src/getValue.js
var getValueFilterSymbol = Symbol.for("getValueFilterSymbol");
function applyGetValueFilter(value, source) {
  let filter = source[getValueFilterSymbol];
  return filter ? filter(value) : value;
}
function getValue(obj) {
  if (obj === null || obj === void 0)
    return obj;
  let value = obj.value;
  if (isFunc(obj.getValue)) {
    value = obj.getValue();
  } else if (isFunc(obj)) {
    value = getValue(obj());
  } else if (isNode(obj)) {
    if (obj.tagName === "INPUT" && obj.type === "checkbox") {
      value = obj.checked;
    }
  } else {
    if (isObj(obj))
      return mapProp(obj, getValue);
  }
  return applyGetValueFilter(value, obj);
}

// ../../libs/jsx6/src/dispose.js
var jsxDisposeSymbol = Symbol.for("jsx6_dispose");
function addDisposer(node, dispose) {
  if (!node || typeof node !== "object" || typeof dispose !== "function")
    return dispose;
  let list = node[jsxDisposeSymbol];
  if (!list) {
    list = [];
    node[jsxDisposeSymbol] = list;
  }
  list.push(dispose);
  return dispose;
}
function release(node) {
  const list = node[jsxDisposeSymbol];
  if (!list || list.length === 0)
    return 0;
  node[jsxDisposeSymbol] = [];
  let count = 0;
  for (const dispose of list) {
    try {
      dispose();
      count++;
    } catch (error) {
      console.error("jsx6 dispose failed", error);
    }
  }
  return count;
}
function disposeNode(node) {
  return walkDispose(node);
}
function walkDispose(node) {
  if (!node || typeof node !== "object")
    return 0;
  if (node instanceof Array) {
    let count2 = release(node);
    for (const child of node)
      count2 += walkDispose(child);
    return count2;
  }
  const el = toDomNode(node);
  let count = 0;
  if (el !== node) {
    count += release(node);
  }
  if (!el || typeof el !== "object")
    return count;
  const children = el.childNodes;
  if (children) {
    const snapshot = Array.from(children);
    for (const child of snapshot)
      count += walkDispose(child);
  }
  count += release(el);
  return count;
}

// ../../libs/jsx6/src/directives.js
var directives = {};
function addDirective(key, directive) {
  directives[key] = directive;
}
addDirective("x-if", (el, a, $signal, self) => {
  let updater = (v) => setAttribute(el, "hidden", !v);
  addDisposer(el, observeNow($signal, updater));
});
addDirective("x-else", (el, a, $signal, self) => {
  let updater = (v) => setAttribute(el, "hidden", !!v);
  addDisposer(el, observeNow($signal, updater));
});
addDirective("x-enabled", (el, a, $signal, self) => {
  let updater = (v) => setAttribute(el, "disabled", !v);
  addDisposer(el, observeNow($signal, updater));
});
addDirective("x-disabled", (el, a, $signal, self) => {
  let updater = (v) => setAttribute(el, "disabled", !!v);
  addDisposer(el, observeNow($signal, updater));
});
addDirective("x-readonly", (el, a, $signal, self) => {
  let updater = (v) => setAttribute(el, "readonly", !!v);
  addDisposer(el, observeNow($signal, updater));
});
addDirective("x-value", (el, a, $signal, self) => {
  let updater = (v) => setValue(el, v);
  addDisposer(el, observeNow($signal, updater));
  const onInput = (e) => $signal(getValue(el));
  el.addEventListener?.("input", onInput);
  addDisposer(el, () => el.removeEventListener?.("input", onInput));
});
addDirective("x-filter", (el, a, filters, self) => {
  if (isArray(filters)) {
    if (filters[0])
      el[getValueFilterSymbol] = requireFunc(filters[0]);
    if (filters[1])
      el[setValueFilterSymbol] = requireFunc(filters[1]);
  } else {
    el[getValueFilterSymbol] = requireFunc(filters);
  }
});

// ../../libs/jsx6/src/findParent.js
function findParent(el, filter, stopFilter) {
  let p = toDomNode(el);
  if (typeof filter === "string") {
    let tagName = filter;
    filter = (p2) => p2.tagName === tagName;
  }
  while (p) {
    if (stopFilter && stopFilter(p))
      break;
    if (filter(p))
      return p;
    p = p.parentNode;
  }
}

// ../../libs/jsx6/src/fireCustom.js
var fireCustom = (el, name, detail) => {
  el.dispatchEvent(new CustomEvent(name, { detail }));
};
var listenCustom = (el, name, callback, options) => {
  const cb = (e) => callback(e.detail || {}, e);
  el.addEventListener(name, cb, options);
  return function() {
    el.removeEventListener(name, cb, options);
  };
};
var listen = (el, name, callback, options) => {
  el.addEventListener(name, callback, options);
  return function() {
    el.removeEventListener(name, callback, options);
  };
};

// ../../libs/jsx6/src/forEachProp.js
function forEachProp(obj, callback) {
  if (obj) {
    if (isObj(obj)) {
      for (const p in obj) {
        callback(obj[p], p, obj);
      }
    } else if (isArray(obj)) {
      obj.forEach(callback);
    }
  }
}

// ../../libs/jsx6/src/getAttr.js
function getAttr(obj, attr, def = null) {
  if (obj) {
    if (obj.getAttribute) {
      let out = obj.getAttribute(attr);
      return out === null ? def : out;
    } else if (obj.el) {
      return getAttr(obj.el, attr, def);
    } else if (obj && isObj(obj)) {
      return mapProp(obj, (o) => getAttr(o, attr, def));
    }
  }
}

// ../../libs/jsx6/src/remove.js
function remove(child) {
  const _child = toDomNode(child);
  disposeNode(_child);
  const parent = _child?.parentNode;
  try {
    parent.removeChild(_child);
  } catch (error) {
    console.error(`failed to remove child: ${describe(_child)} (parent: ${describe(parent)})`);
    throw error;
  }
}
var describe = (node) => node ? `${node.nodeName || node.constructor?.name || typeof node}` : String(node);

// ../../libs/jsx6/src/jsx2dom.js
var markerSymbol = Symbol.for("jsx2dom_marker");
var scopeSymbol = Symbol.for("jsx2dom_scope");
if (globalThis[markerSymbol])
  console.warn(errorMessage(JSX6E15_MULTIPLE_VERSIONS), globalThis[markerSymbol]);
globalThis[markerSymbol] = new Error("marker");
var getScope = () => globalThis[scopeSymbol];
var setScope = (s) => globalThis[scopeSymbol] = s;
function h(tag, attr, ...children) {
  return toDom(tag, attr || {}, children);
}
function toDom(tag, attr, children) {
  if (!tag)
    return children;
  let oncreate = attr?.oncreate;
  if (oncreate)
    delete attr.oncreate;
  let out;
  if (isStr(tag)) {
    out = factories.Element(tag);
    insertAttr(attr, out);
    insert(out, children);
  } else {
    if (isFunc(tag)) {
      const { p } = attr;
      const parent = getScope();
      let innerScope = {};
      try {
        setScope(innerScope);
        if (tag.prototype) {
          out = new tag(attr, children, parent);
        } else {
          out = tag(attr, children, innerScope, parent);
        }
        if (p)
          setPropGroup(parent, out, p);
      } finally {
        setScope(parent);
      }
    } else if (isNode(tag)) {
      out = tag;
    } else if (isObj(tag)) {
      out = nodeFromObservable(tag) || throwErr(JSX6E2_UNSUPPORTED_TAG, tag);
    } else {
      throwErr(JSX6E2_UNSUPPORTED_TAG, tag);
    }
  }
  if (oncreate) {
    if (isArray(oncreate)) {
      oncreate.forEach((f) => f(out, getScope()));
    } else {
      oncreate(out, getScope());
    }
  }
  return out;
}
var hSvg = (tag, attr, ...children) => {
  const out = factories.Svg(tag);
  insertAttr(attr, out);
  children.forEach((c) => insert(out, c));
  return out;
};
function nodeFromObservable(obj) {
  const textNode = factories.Text("");
  const out = [textNode];
  const updater = (r) => {
    if (r instanceof Array && r.length === 1)
      r = r[0];
    let node = toDomNode(r);
    const parent = textNode.parentNode;
    if (parent) {
      while (out.length > 1) {
        const toRemove = out.shift();
        remove(toRemove);
      }
    } else if (out.length > 1) {
      out.length = 1;
      out[0] = textNode;
    }
    if (isFunc(node))
      node = node(parent);
    if (isNode(node)) {
      updateTextNode(textNode, "");
      if (parent)
        insert(parent, node, textNode);
      out.length = 2;
      out[0] = node;
      out[1] = textNode;
    } else if (r instanceof Array) {
      updateTextNode(textNode, "");
      if (parent)
        r = insert(parent, r, textNode);
      out.length = r.length;
      for (let i = 0; i < r.length; i++)
        out[i] = r[i];
      out.push(textNode);
    } else {
      updateTextNode(textNode, factories.TextValue(r));
    }
  };
  addDisposer(textNode, observeNow(obj, updater));
  return out;
}
function updateTextNode(node, text) {
  if (node.textContent !== text)
    node.textContent = text;
}
function domWithScope(scope, f) {
  const old = getScope();
  try {
    setScope(scope);
    return f(h);
  } finally {
    setScope(old);
  }
}
var TextValue = (v) => {
  if (v === null || v === void 0)
    return "";
  if (!isStr(v))
    return "" + v;
  return v;
};
var makeAttrUpdater = (node, attr, func) => {
  const out = () => {
    setAttribute(node, attr, func());
  };
  out.node = node;
  out.attr = attr;
  out.func = func;
  return out;
};
function insertAttr(attr, out, self, component) {
  if (!attr)
    return;
  if (!self)
    self = getScope();
  for (let a in attr) {
    let value = attr[a];
    if (a[0] === "o" && a[1] === "n") {
      if (isFunc(value)) {
        const eventName = a.substring(2).toLowerCase();
        const listener = value.bind(self);
        out.addEventListener(eventName, listener);
        if (typeof out.removeEventListener === "function") {
          addDisposer(out, () => out.removeEventListener(eventName, listener));
        }
      } else {
        throwErr(JSX6E9_LISTENER_MUST_BE_FUNC, attr);
      }
      value = void 0;
    } else if (a === "key") {
      out.loopKey = value;
      if (!out.$key) {
        out.$key = value;
      }
      if (component) {
        if (!component.$key) {
          component.$key = value;
        }
        component.loopKey = value;
      }
    } else if (a[0] === "x") {
      let directive = directives[a];
      if (directive) {
        directive(out, a, value, self);
        value = null;
      }
    } else if (a === "p") {
      setPropGroup(self, component || out, value);
    }
    if (value !== void 0) {
      if (isFunc(value)) {
        let updater = makeAttrUpdater(out, a, value);
        addDisposer(out, observeNow(value, updater));
      } else if (out.setAttribute) {
        setAttribute(out, a, value);
      }
    }
  }
}
function setPropGroup(self, part, path) {
  if (isFunc(path)) {
    return path(part);
  }
  if (isStr(path))
    path = path.split(".");
  const [$group, $key] = path;
  if (self === void 0)
    throw throwErr(JSX6E10_CONTEXT_REQUIRED);
  if ($key) {
    if (!self[$group])
      self[$group] = new Group();
    self[part.$group = $group][part.$key = $key] = part;
  } else {
    self[part.$key = $group] = part;
  }
}
var forInsertFuncObj = (newChild) => {
  let maybe = nodeFromObservable(newChild);
  if (maybe?.length === 1)
    maybe = maybe[0];
  return maybe || factories.Text(factories.TextValue(newChild));
};
function forInsert(newChild) {
  if (newChild instanceof Array) {
    return newChild.map((c) => forInsert(c));
  }
  if (isFunc(newChild)) {
    newChild = forInsertFuncObj(newChild);
  } else if (!isNode(newChild)) {
    if (isNode(newChild.el)) {
      newChild = newChild.el;
    } else {
      newChild = forInsertFuncObj(newChild);
    }
  }
  return newChild;
}
function insert(parent, newChild, before = void 0) {
  if (newChild === void 0 || newChild === null)
    return;
  if (!parent)
    throwErr(JSX6E8_REQUIRE_PARENT, { parent, newChild, before });
  if (newChild instanceof Array) {
    return newChild.map((c) => insert(parent, c, before));
  }
  const _parent = parent.insertBefore ? parent : toDomNode(parent);
  if (!_parent.insertBefore)
    console.error("missing insertBefore", _parent, parent);
  let _newChild;
  try {
    _newChild = forInsert(newChild);
    if (_newChild instanceof Array) {
      _newChild.forEach((c) => _parent.insertBefore(c, toDomNode(before)));
    } else {
      _parent.insertBefore(_newChild, toDomNode(before));
    }
  } catch (error) {
    console.error("parent", parent, "newChild", newChild, "before", before, "forInsert", _newChild);
    throw error;
  }
  return _newChild;
}
var factories = {
  TextValue,
  Text: (t2) => document.createTextNode(t2),
  Svg: (t2) => t2 ? document.createElementNS("http://www.w3.org/2000/svg", t2) : throwErr(JSX6E1_NULL_TAG),
  Html: (t2, o) => t2 ? document.createElement(t2, o) : throwErr(JSX6E1_NULL_TAG),
  Element: (t2, o) => factories.Html(t2, o)
};

// ../../libs/jsx6/src/setAttrBoolean.js
function setAttrBoolean(obj, attr, value) {
  if (obj) {
    if (obj.setAttribute) {
      if (value) {
        if (!obj.hasAttribute(attr))
          obj.setAttribute(attr, attr);
      } else {
        if (obj.hasAttribute(attr))
          obj.removeAttribute(attr);
      }
    } else if (isNode(obj.el)) {
      setAttrBoolean(obj.el, attr, value);
    } else if (isObj(obj)) {
      for (const p in obj) {
        setAttrBoolean(obj[p], attr, p === value);
      }
    }
  }
}

// ../../libs/jsx6/src/setSelected.js
function setSelected(obj, sel) {
  if (!obj)
    return;
  if (obj instanceof Group) {
    mapProp(obj, (o, p) => setSelected(o, p === sel));
  } else {
    setAttrBoolean(obj, "selected", sel);
  }
}

// ../../libs/jsx6/src/setVisible.js
function setVisible(obj, sel) {
  if (!obj)
    return;
  if (obj instanceof Group) {
    forEachProp(obj, (o, p) => setVisible(o, p === sel));
  } else if (obj instanceof Array) {
    obj.forEach((o, p) => setVisible(o, p === sel));
  } else {
    setAttrBoolean(obj, "hidden", !sel);
  }
}

// ../../libs/w/src/JsxW.js
var JsxW = class extends HTMLElement {
  static {
    define("jsx6-wc", this);
  }
  /**
   * Optional form-like object (see `linkForm`). Consumer code can assign it; when present,
   * getValue/setValue read and write that object instead of the internal `$v` proxy.
   * This class never assigns it itself.
   * @type {any}
   */
  form;
  constructor(attr, children, parent, shadow, shadowOptions) {
    super();
    if (shadow) {
      this.attachShadow({ ...shadowOptions, mode: "open" });
      globalThis.activateJsxInspector?.(this.shadowRoot);
    }
    let tpl = domWithScope(this, () => this.tpl(attr || {}, children, parent));
    if (typeof tpl === "function") {
      this.__init = () => {
        insert(this.shadowRoot || this, tpl());
      };
    } else {
      insert(this.shadowRoot || this, tpl);
    }
    this.onCreate();
  }
  onCreate() {
  }
  /**
   * Builds the content of the component. Override in a subclass.
   * @param {Object} attr attributes and properties passed to the component
   * @param {Array<any>} children children passed to the component
   * @param {Object} [parent] scope of the parent component (see `domWithScope`)
   */
  tpl(attr, children, parent) {
    insertAttr(attr, this, this, this);
    insert(this, children);
  }
  initState(values = {}) {
    return this._$s = $State(values);
  }
  /*  Lazy initialize state proxy object*/
  get $s() {
    if (!this._$s)
      return this.initState();
    return this._$s;
  }
  /*  Lazy initialize value proxy object*/
  get $v() {
    if (!this.__$v) {
      this.__$v = $State({});
    }
    return this.__$v;
  }
  getValue() {
    return this.form ? getValue(this.form) : this.$v();
  }
  setValue(v) {
    if (this.form)
      setValue(this.form, v);
    else
      this.$v(v);
  }
  mergeValue(v) {
    mergeValue(this.$v, v);
  }
  mergeState(v) {
    mergeValue(this.$s, v);
  }
  /**
   * https://gomakethings.com/the-handleevent-method-is-the-absolute-best-way-to-handle-events-in-web-components/
   * @param {*} event
   */
  handleEvent(event) {
    this[`on${event.type}`](event);
  }
};
var JsxWS = class extends JsxW {
  static {
    define("jsx6-wcs", this);
  }
  constructor(attr, children, parent, shadowOptions) {
    super(attr, children, parent, true, shadowOptions);
  }
};
function define(tag, customElement) {
  if (customElements.get(tag)) {
    console.warn("JSX6E16 custom element already defined");
  } else {
    customElements.define(tag, customElement);
  }
}

// ../../libs/dom-observer/src/makeObserverHandler.js
var makeObserverHandler = (name) => {
  const listenMap = /* @__PURE__ */ new WeakMap();
  const listener = (
    /** @type {ObserverHandler} */
    (entries) => {
      entries.forEach((entry) => {
        listenMap.get(entry.target)?.forEach((fn) => {
          try {
            if (fn)
              fn(entry);
          } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.error(`problem calling ${name} listener:  ${message}`, fn, e);
          }
        });
      });
    }
  );
  listener.observer = /** @type {AttachedObserver} */
  /** @type {unknown} */
  void 0;
  listener.observe = (el, callback, options) => {
    const observer = listener.observer;
    let arr = listenMap.get(el);
    if (!arr) {
      observer.observe(el, options);
      listenMap.set(el, arr = []);
    }
    arr.push(callback);
    return () => {
      let arr2 = listenMap.get(el);
      if (arr2) {
        let count = arr2.length;
        let countLeft = 0;
        for (let i = 0; i < count; i++) {
          if (arr2[i] === callback)
            arr2[i] = void 0;
          if (arr2[i])
            countLeft++;
        }
        if (!countLeft) {
          listenMap.delete(el);
          observer.unobserve(el);
        }
      }
    };
  };
  return listener;
};

// ../../libs/dom-observer/src/observeIntersect.js
var oberverMapBrowser = /* @__PURE__ */ new Map();
var observerSymbol = Symbol("observeIntersect");
function observeIntersect(el, callback, { root, rootMargin, threshold, detail } = {}) {
  if (!threshold && detail && typeof detail === "number") {
    threshold = [0];
    for (let i = detail; i < 1; i += detail) {
      threshold.push(i);
    }
    threshold.push(1);
  }
  const key = JSON.stringify({ rootMargin, threshold });
  let observerMap;
  if (root) {
    observerMap = root[observerSymbol] = root[observerSymbol] || /* @__PURE__ */ new Map();
  } else {
    observerMap = oberverMapBrowser;
  }
  let handler = observerMap.get(key);
  if (!handler) {
    handler = makeObserverHandler("IntersectionObserver");
    const observer = new IntersectionObserver(handler, { root, rootMargin, threshold });
    handler.observer = observer;
    observerMap.set(key, handler);
  }
  return handler.observe(el, callback);
}

// ../../libs/dom-observer/src/observeShowHide.js
var visibleThreshold = [0, 1e-4];
function observeShowHide(el, callback, { root, rootMargin, threshold = visibleThreshold } = {}) {
  return observeIntersect(el, callback, { root, rootMargin, threshold });
}

// src/runtime-default.js
var defaultRuntime = {
  addClass,
  classIf,
  findParent,
  fireCustom,
  getAttr,
  hSvg,
  insert,
  isNode,
  listen,
  listenCustom,
  remove,
  runFuncNoArg,
  setAttribute,
  setSelected,
  setVisible,
  toDomNode,
  $Or,
  observeNow,
  JsxW,
  define,
  observeShowHide
};

// src/runtime.js
var replacement = null;
var resolved = null;
var backend = {
  get current() {
    if (!replacement)
      return defaultRuntime;
    if (!resolved)
      resolved = { ...defaultRuntime, ...replacement };
    return resolved;
  }
};

// src/listenUntil.js
var map = /* @__PURE__ */ new WeakMap();
function listenUntil(ref, el, name, cb, options) {
  return addFinalizer(ref, backend.current.listen(el, name, cb, options));
}
function addFinalizer(ref, fn) {
  let arr = map.get(ref);
  if (!arr)
    map.set(ref, arr = []);
  arr.push(fn);
  return fn;
}
function finalize(ref) {
  map.get(ref)?.forEach(backend.current.runFuncNoArg);
  map.delete(ref);
  if (backend.current.isNode(ref?.el))
    finalize(ref.el);
}

// src/makeLineConnector.js
var { min, sqrt } = Math;
var makeLineConnector = (strength, p1, box1, box1pos, dir1, p2, box2, box2pos, dir2) => {
  let [left1, top1] = p1;
  let [left2, top2] = p2;
  strength = min(strength, sqrt((left1 - left2) ** 2 + (top1 - top2) ** 2) / 2);
  return `M${left1} ${top1} C${left1 + strength} ${top1} ${left2 - strength} ${top2} ${left2} ${top2}`;
};

// src/svgUtil.js
var makeLine = (strength) => backend.current.hSvg("path", {
  strength,
  style: `vector-effect:non-scaling-stroke;pointer-events:auto;cursor:pointer`,
  fill: "none"
});

// src/ConnectLine.js
var ConnectLine = class {
  constructor({ strength = 60 } = {}) {
    this.strength = strength;
    this.el = backend.current.hSvg("g", {}, this.line1 = makeLine(strength), this.line2 = makeLine(strength));
    this.updateAria();
    this.p1 = { pos: [0, 0], listen: [], align: "right", con: null };
    this.p2 = { pos: [0, 0], listen: [], align: "left", con: null };
    this.pathListeners = [];
    addFinalizer(this, () => this.finalize());
  }
  /**
   *
   * @param {ConnectorData|null} con
   * @param {boolean} [skipUpdate]
   */
  setPoint1(con, skipUpdate) {
    this.setPoint(this.p1, con, skipUpdate);
  }
  /**
   *
   * @param {ConnectorData} con
   * @param {boolean} [skipUpdate]
   */
  setPoint2(con, skipUpdate) {
    this.setPoint(this.p2, con, skipUpdate);
  }
  finalize() {
    this.p1.listen?.forEach(backend.current.runFuncNoArg);
    this.p2.listen?.forEach(backend.current.runFuncNoArg);
    this.pathListeners.length = 0;
  }
  /**
   * @param {LinePoint} p
   * @param {ConnectorData} con
   * @param {boolean} [skipUpdate]
   */
  setPoint(p, con, skipUpdate) {
    let old = p.con;
    p.con = con;
    if (old)
      p.listen?.forEach(backend.current.runFuncNoArg);
    this.updateAria();
    if (!con)
      return;
    this.setPosAligned(p, con, skipUpdate);
    let source = con.root?.editor || con.editor;
    p.listen[0] = source ? backend.current.listenCustom(source, "ne-move", (detail) => {
      if (detail.stamp === con.movedStamp)
        this.setPosAligned(p, con);
    }) : backend.current.listenCustom(con.el, "ne-move", () => {
      this.setPosAligned(p, con);
    });
    p.listen[1] = backend.current.listenCustom(con.el, "ne-remove", (_detail) => {
      this.setPoint(p, null);
    });
    if (!skipUpdate)
      this.updatePath();
  }
  /**
   *
   * @param {LinePoint} p
   * @param {ConnectorData} con
   * @param {boolean} [skipUpdate]
   */
  setPosAligned(p, con, skipUpdate) {
    let [x, y] = con.pos;
    let [w, h2] = con.size;
    y += Math.floor(h2 / 2) + con.offsetY;
    x += Math.floor(w / 2) + con.offsetX;
    p.pos = [x, y];
    if (!skipUpdate)
      this.updatePath();
  }
  setPos(x1, y1, x2, y2) {
    this.p1.pos = [x1, y1];
    this.p2.pos = [x2, y2];
    this.updatePath();
  }
  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {boolean} [skipUpdate]
   */
  setPos1(x, y, skipUpdate) {
    this.p1.pos = [x, y];
    if (!skipUpdate)
      this.updatePath();
  }
  /**
   *
   * @param {number} x
   * @param {number} y
   * @param {boolean} [skipUpdate]
   */
  setPos2(x, y, skipUpdate) {
    this.p2.pos = [x, y];
    if (!skipUpdate)
      this.updatePath();
  }
  updatePath() {
    let line = makeLineConnector(
      this.strength,
      this.p1.pos,
      this.p1.pos,
      // todo box pos
      [100, 100],
      "R",
      this.p2.pos,
      [0, 0],
      // todo box pos
      [100, 100],
      "L"
    );
    this.d = line;
    this.line1.setAttribute("d", line);
    this.line2.setAttribute("d", line);
    this.pathListeners.forEach((fn) => fn(line));
  }
  /**
   * Register a callback invoked whenever the path is recomputed, with the new
   * `d`. Returns an unregister function.
   *
   * Used by the canvas line layer to redraw while a free (still unconnected)
   * end is being dragged: that move fires no `ne-move` event, and the SVG
   * paths that `updatePath` updates are not in the DOM in canvas mode.
   *
   * @param {(d: string) => void} fn
   * @returns {() => void}
   */
  onPathChange(fn) {
    this.pathListeners.push(fn);
    return () => {
      let i = this.pathListeners.indexOf(fn);
      if (i >= 0)
        this.pathListeners.splice(i, 1);
    };
  }
  /**
   * Kept as a no-op for backward compatibility (and because `setPoint` calls it).
   *
   * It used to write the endpoint pair into an `aria-label` on the line's `g`. Lines are no longer
   * focusable and carry no accessibility markup, so there is nothing to update. Endpoints are still
   * readable from the DOM through the line's `p1.con.idFull` / `p2.con.idFull`.
   */
  updateAria() {
  }
  /**
   * @param {boolean} sel
   */
  setSelected(sel) {
    this.selected = sel;
    backend.current.classIf(this.el, "selected", sel);
  }
};

// src/lineLayer.js
function createSvgLineLayer(editor) {
  return {
    kind: "svg",
    /** @type {SVGElement} */
    el: editor.svgLayer,
    /**
     * Attach the line's `<g>` and let it select itself on click — the exact
     * pre-seam behaviour.
     * @param {ConnectLine} line
     */
    add(line) {
      listenUntil(line, line.el, "click", () => {
        editor.selectConnector(line);
      });
      backend.current.insert(editor.svgLayer, line.el);
    },
    /**
     * Detach the line's element. (Its listeners are released by the editor's
     * `finalize(line)`; the layer owns only the element.)
     * @param {ConnectLine} line
     */
    remove(line) {
      backend.current.remove(line.el);
    },
    /**
     * Apply the three visual states with the same `classIf` calls the CSS
     * (`.selected`, `.ne-from-sel-block`, `.ne-to-sel-block`) keys on.
     * @param {ConnectLine} line
     * @param {boolean} selected
     * @param {boolean} fromSel
     * @param {boolean} toSel
     */
    setStates(line, selected, fromSel, toSel) {
      backend.current.classIf(line.el, "selected", selected);
      backend.current.classIf(line.el, "ne-from-sel-block", fromSel);
      backend.current.classIf(line.el, "ne-to-sel-block", toSel);
    },
    /**
     * Never hit: in SVG mode the `<g>`'s own click listener selects the line,
     * and the editor's `g`-lookup resolves right-click / Enter / Space.
     * @returns {null}
     */
    pick() {
      return null;
    },
    onViewport() {
    },
    onResize() {
    },
    /**
     * Nothing to release: the `<svg>` element stays owned by the editor.
     */
    dispose() {
    }
  };
}

// src/LineInteraction.js
var LineInteraction = class {
  /** @type {NodeEditor} */
  editor;
  /**
   * @param {NodeEditor} editor
   */
  constructor(editor) {
    this.editor = editor;
  }
  /**
   * @param {ConnectorData} con
   */
  newConnector(con) {
    const markTarget = (con2, mark) => {
      if (con2)
        backend.current.classIf(con2.el, "target", mark);
    };
    let isDown = false;
    let isMoving = false;
    let lx = 0;
    let ly = 0;
    let line;
    let firstCon;
    let otherCon;
    let freeEnd;
    const setFreePos = (x, y) => {
      if (freeEnd == "p1")
        line.setPos1(x, y);
      else
        line.setPos2(x, y);
    };
    const setFreePoint = (c) => {
      if (freeEnd == "p1")
        line.setPoint1(c);
      else
        line.setPoint2(c);
    };
    let lastX = 0;
    let lastY = 0;
    let hoverRaf = 0;
    const hoverStep = () => {
      if (!isDown || !isMoving)
        return;
      let rect = this.editor.getBoundingClientRect();
      let x = lastX;
      let y = lastY;
      let target2 = (
        /** @type {HTMLConnector} */
        document.elementFromPoint(x, y)
      );
      let connectorData = target2?.ncData;
      if (connectorData?.dir == "out")
        connectorData = null;
      if (connectorData && connectorData != firstCon) {
        markTarget(connectorData, 1);
        otherCon = connectorData;
        setFreePoint(otherCon);
      } else {
        if (otherCon)
          markTarget(otherCon, connectorData == otherCon);
        if (connectorData == firstCon || !connectorData) {
          otherCon = null;
        }
        setFreePos((x - 1 - rect.x) / this.editor.zoom, (y - rect.y) / this.editor.zoom);
      }
    };
    const scheduleHover = () => {
      if (hoverRaf)
        return;
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = 0;
        hoverStep();
      });
    };
    const flushHover = () => {
      if (!hoverRaf)
        return;
      cancelAnimationFrame(hoverRaf);
      hoverRaf = 0;
      hoverStep();
    };
    const pointerdown = (e) => {
      lx = e.clientX;
      ly = e.clientY;
      let selected = this.editor.selectedLine;
      if (selected) {
        if (selected.p2.con == con) {
          line = selected;
          firstCon = con;
          freeEnd = "p2";
          isDown = true;
          return;
        }
        if (selected.p1.con == con) {
          line = selected;
          firstCon = con;
          freeEnd = "p1";
          isDown = true;
          return;
        }
      }
      if (con.dir == "in")
        return;
      if (this.editor.lineHasConnector(con))
        return;
      freeEnd = "p2";
      isDown = true;
    };
    const pointermove = (e) => {
      if (!isDown)
        return;
      let x = lastX = e.clientX;
      let y = lastY = e.clientY;
      if (!isMoving) {
        if (!line)
          line = this.editor.addConnector(new ConnectLine());
        this.editor.selectConnector(line);
        line.setSelected(true);
        if (!line.p1.con)
          line.setPoint1(con);
        firstCon = con;
        markTarget(con, 1);
        let rect = this.editor.getBoundingClientRect();
        setFreePos((x - 1 - rect.x) / this.editor.zoom, (y - rect.y) / this.editor.zoom);
        con.el.setPointerCapture(e.pointerId);
        isMoving = true;
      }
      scheduleHover();
    };
    const pointerup = (e) => {
      if (!isDown)
        return;
      flushHover();
      if (isMoving)
        con.el.releasePointerCapture(e.pointerId);
      markTarget(firstCon);
      markTarget(otherCon);
      if (otherCon) {
        line.setSelected(true);
      } else {
        this.editor.removeLine(line);
      }
      isDown = false;
      isMoving = false;
      line = null;
      this.editor.historyRecord("connect");
      this.editor.focus();
    };
    listenUntil(con.el, con.el, "pointerdown", pointerdown);
    listenUntil(con.el, con.el, "pointermove", pointermove);
    listenUntil(con.el, con.el, "pointerup", pointerup);
  }
};

// src/calcPos.js
var calcPos = (el, root) => {
  let top = 0;
  let left = 0;
  while (el && el != root) {
    top += el.offsetTop + el.clientTop;
    left += el.offsetLeft + el.clientLeft;
    el = el.offsetParent;
  }
  return [left, top];
};

// src/pairUtils.js
var pairChanged = (a, b) => a[0] != b[0] || a[1] != b[1];
var pairSum = (a, b) => [a[0] + b[0], a[1] + b[1]];

// src/connectorUtil.js
function findConnector(blockData, force) {
  let { connectorMap, el: rootNode } = blockData;
  if (!force && !blockData.structDirty && blockData.resizeSet) {
    return { resizeSet: blockData.resizeSet, cached: true };
  }
  let resizeSet = /* @__PURE__ */ new Set();
  resizeSet.add(rootNode);
  visit(rootNode);
  blockData.structDirty = false;
  return { resizeSet, cached: false };
  function visit(el) {
    let ncId = getAttr(el, "ncid");
    if (ncId) {
      let connectData = connectorMap.get(ncId);
      let stale = connectData && connectData.el !== el && !connectData.el.isConnected;
      if (connectData && stale) {
        addResize(resizeSet, el, rootNode, blockData);
        let cStyle = getComputedStyle(el);
        connectData.el.removeObserve?.();
        connectData.el = el;
        connectData.dir = getAttr(el, "ne-connect");
        connectData.relPos = calcPos(el, blockData.el);
        connectData.offsetX = parseFloat(cStyle.getPropertyValue("--offset-x")) || 0;
        connectData.offsetY = parseFloat(cStyle.getPropertyValue("--offset-y")) || 0;
        connectData.size = [el.offsetWidth, el.offsetHeight];
        el.removeObserve = observeShowHide(
          el,
          (entry) => {
            if (!entry.intersectionRatio && !el.isConnected)
              blockData.editor.removeConnector(connectData);
          },
          { root: rootNode }
        );
        el.ncId = ncId;
        el.ncData = connectData;
        setAttribute(el, "ne-nodrag", true);
        updatePos(connectData);
        blockData.editor?.reattachLines?.(connectData);
        blockData.editor?.queueMove?.(connectData);
      } else if (!connectData) {
        addResize(resizeSet, el, rootNode, blockData);
        let cStyle = getComputedStyle(el);
        let relPos = calcPos(el, blockData.el);
        connectData = {
          id: ncId,
          dir: getAttr(el, "ne-connect"),
          changed: 1,
          pos: [0, 0],
          idFull: blockData.id + "/" + ncId,
          el,
          relPos,
          offsetX: parseFloat(cStyle.getPropertyValue("--offset-x")) || 0,
          offsetY: parseFloat(cStyle.getPropertyValue("--offset-y")) || 0,
          root: blockData,
          editor: this,
          size: [el.offsetWidth, el.offsetHeight]
        };
        el.removeObserve = observeShowHide(
          el,
          (entry) => {
            if (!entry.intersectionRatio && !el.isConnected)
              blockData.editor.removeConnector(connectData);
          },
          { root: rootNode }
        );
        blockData.editor.newConnector(connectData);
        connectorMap.set(ncId, connectData);
        updatePos(connectData);
        el.ncId = ncId;
        el.ncData = connectData;
        setAttribute(el, "ne-nodrag", true);
      }
    }
    let ch = el.firstElementChild;
    while (ch) {
      visit(ch);
      ch = ch.nextElementSibling;
    }
  }
}
function addResize(resizeSet, el, rootNode, blockData) {
  resizeSet.add(el);
  el = el.parentElement;
  el.neBlock = blockData;
  if (el != rootNode)
    addResize(resizeSet, el, rootNode, blockData);
}
function recalcPos(connectData) {
  connectData.relPos = calcPos(connectData.el, connectData.root.el);
  updatePos(connectData);
}
function updatePos(connectData) {
  connectData.pos = pairSum(connectData.relPos, connectData.root.pos);
}

// src/getBlocksMinXY.js
function getBlocksMinXY(blocks) {
  if (!blocks?.length)
    return [0, 0];
  let minx;
  let miny = minx = Number.MAX_SAFE_INTEGER;
  blocks.forEach((blockData) => {
    let [x, y] = blockData.pos;
    minx = Math.min(minx, x);
    miny = Math.min(miny, y);
  });
  return [minx, miny];
}

// src/getBlocksBounds.js
function getBlocksBounds(blocks) {
  if (!blocks?.length)
    return { x: 0, y: 0, maxx: 0, maxy: 0, w: 0, h: 0 };
  let minx;
  let miny = minx = Number.MAX_SAFE_INTEGER;
  let maxx;
  let maxy = maxx = Number.MIN_SAFE_INTEGER;
  blocks.forEach((blockData) => {
    let [x, y] = blockData.pos;
    let [w, h2] = blockData.size;
    minx = Math.min(minx, x);
    miny = Math.min(miny, y);
    maxx = Math.max(maxx, x + w);
    maxy = Math.max(maxy, y + h2);
  });
  return { x: minx, y: miny, maxx, maxy, w: maxx - minx, h: maxy - miny };
}

// src/moveMenu.js
var menuSize = (menu, zoom) => {
  let size = menu._neMenuSize;
  if (size)
    return size;
  let rect = menu.getBoundingClientRect();
  size = [rect.width / zoom, rect.height / zoom];
  if (!size[0] || !size[1])
    return size;
  menu._neMenuSize = size;
  if (typeof MutationObserver === "function" && !menu._neMenuObs) {
    menu._neMenuObs = new MutationObserver(() => {
      menu._neMenuSize = null;
    });
    menu._neMenuObs.observe(menu, { childList: true, subtree: true, characterData: true });
  }
  return size;
};
var moveMenu = (blocks, menu, zoom = 1) => {
  if (menu.moveMenu)
    return menu.moveMenu(blocks, menu);
  let [w, h2] = menuSize(menu, zoom);
  let b = getBlocksBounds(blocks);
  let { style } = menu;
  style.setProperty("--ne-menu-x", b.x + b.w / 2 - w / 2 + "px");
  style.setProperty("--ne-menu-y", b.y - h2 + "px");
};

// src/updateObserver.js
function updateObserver(newSet, oldSet, observer) {
  let removed = /* @__PURE__ */ new Set();
  newSet.forEach((el) => {
    if (!oldSet.has(el)) {
      observer.observe(el);
    }
  });
  oldSet.forEach((el) => {
    if (!newSet.has(el)) {
      observer.unobserve(el);
      removed.add(el);
    }
  });
  return removed;
}

// ../../libs/jsx-runtime/index.js
function jsx(tag, { children, ...attr }) {
  if (tag === Fragment)
    return children;
  return toDom(tag, attr, children);
}
var Fragment = (attr, children) => children;

// src/NodeEditor.jsx
var microtask = (fn) => typeof queueMicrotask === "function" ? queueMicrotask(fn) : Promise.resolve().then(fn);
var NodeEditor = class extends JsxW {
  static {
    define("jsx6-nodditor", this);
  }
  /** @type {Array<BlockData>} */
  blocks = [];
  /** @type {Array<ConnectLine>} */
  lines = [];
  /** @type {ConnectLine} */
  selectedLine;
  /** @type {Array<BlockData>} */
  selectedBlocks;
  blockMap = /* @__PURE__ */ new Map();
  nodeMap = /* @__PURE__ */ new Map();
  /** @type {HTMLElement} */
  currentMenu = null;
  /**
   * @param {ConnectorData} con
   */
  newConnector(con) {
    this.lineinteraciton.newConnector(con);
  }
  /**
   * Correctly-spelled alias of the misspelled `lineinteraciton` property.
   * The old name is kept for backward compatibility; a breaking rename to
   * this spelling is planned for v2 (see CHANGELOG).
   * @returns {LineInteraction}
   */
  get lineinteraction() {
    return this.lineinteraciton;
  }
  /** @param {LineInteraction} v */
  set lineinteraction(v) {
    this.lineinteraciton = v;
  }
  /**
   * Register a block element with the editor.
   *
   * The editor never builds block markup — that is the host's, and it is the reason `typeMap`
   * factories exist. This method takes whatever element the host produced and makes it a block;
   * connectors are then discovered from that markup (`ncid` / `ne-connect`), which is the step that
   * has to happen before any line can refer to them.
   *
   * @param {any} block the block element (or a component with `.el`); any markup the host likes
   * @param {string} id block id; also written to the element as `nid`
   * @param {Object} [param2]
   * @param {Array<number>} [param2.pos] initial content position
   * @param {string} [param2.type] type used by `saveGraph`/`loadGraph`
   * @returns {BlockData}
   */
  add(block, id, { pos = [0, 0], type = "" } = {}) {
    if (this.blockMap.has(id))
      throw new Error(`NodeEditor: block id "${id}" is already in use`);
    setAttribute(block, "nid", id);
    let rootNode = (
      /** @type {HTMLBlock}*/
      toDomNode(block)
    );
    block.setNodeEditor?.(this);
    rootNode.nodeEditor = this;
    insert(this.contentArea, rootNode);
    let blockData = rootNode.neBlock = {
      id,
      type,
      pos: [0, 0],
      size: [0, 0],
      el: rootNode,
      block,
      map: /* @__PURE__ */ new Map(),
      resizeSet: /* @__PURE__ */ new Set(),
      connectorMap: /* @__PURE__ */ new Map(),
      editor: this
    };
    rootNode.setAttribute("role", "group");
    rootNode.setAttribute("tabindex", "0");
    this.setBlockLabel(blockData, false);
    blockData.structDirty = true;
    this.blocks.push(blockData);
    this.blockMap.set(id, blockData);
    this.nodeMap.set(blockData.el, blockData);
    this.setPos(blockData, pos);
    this.recheckConnectors(blockData);
    this.historyRecord("add");
    return blockData;
  }
  /**
   * P3-1: ONE `MutationObserver` for the whole canvas. It resolves each batch of
   * childList records to the block whose DOM actually changed and marks that
   * block dirty, which is what lets `findConnector` skip the subtree walk for
   * every other block (connector discovery is memoized per block).
   * Only `childList` is watched: attribute/style writes (a move, a resize, the
   * `ne-nodrag` marker `findConnector` itself sets) must not look like a
   * structural change.
   */
  ensureStructObserver() {
    if (this._structMO || typeof MutationObserver !== "function")
      return;
    this._structMO = new MutationObserver((records) => {
      records.forEach((r) => {
        let blockData = this.resolveBlockForRecord(r);
        if (blockData) {
          blockData.structDirty = true;
          this.scheduleConnectorRecheck(blockData);
        }
      });
    });
    this._structMO.observe(this.contentArea, { childList: true, subtree: true });
  }
  /**
   * The `BlockData` a `MutationRecord` belongs to, or `null`.
   *
   * `neBlock` is the normal hit (no attribute read). The `nid` fallback covers a block whose element
   * the host replaced: the registered element is then detached and the new one — which `add` marked
   * with `nid` — has to be adopted, or discovery would keep walking the dead element.
   *
   * @param {MutationRecord} r
   * @returns {BlockData|null}
   */
  resolveBlockForRecord(r) {
    for (let p = r.target; p; p = p.parentElement) {
      if (p.neBlock)
        return p.neBlock;
      if (p === this.contentArea)
        break;
      let nid = p.getAttribute?.("nid");
      if (nid != null) {
        let blockData = this.blockMap.get(nid);
        if (blockData)
          return this.adoptBlockElement(blockData, p);
      }
    }
    return null;
  }
  /**
   * Point a block at the element that is in the DOM now (the host replaced it), keeping `nodeMap` in
   * sync so `getBlockData(element)` keeps resolving.
   * @param {BlockData} blockData
   * @param {HTMLElement} el
   * @returns {BlockData}
   */
  adoptBlockElement(blockData, el) {
    if (blockData.el !== el) {
      this.nodeMap.delete(blockData.el);
      blockData.el = el;
      this.nodeMap.set(el, blockData);
    }
    return blockData;
  }
  /**
   * Make the connector set of a block match its DOM again.
   *
   * Memoised by design (P3-1): the subtree is re-walked only when the block is marked structurally
   * dirty — by the canvas `MutationObserver`, or by [add](#add) which starts a block dirty. Pass
   * `force = true` when the caller *knows* the DOM changed outside what the observer can see:
   * a block whose connectors were added while it was **detached** (its mutations were never
   * observed), or a read in the same task as the DOM change, before the observer's microtask ran.
   *
   * @param {BlockData} blockData
   * @param {boolean} [force] walk the subtree even when the block is not marked dirty
   */
  recheckConnectors(blockData, force) {
    if (force)
      blockData.structDirty = true;
    let { resizeSet, cached } = findConnector(blockData);
    if (cached)
      return;
    resizeSet = /* @__PURE__ */ new Set([blockData.el]);
    blockData.connectorMap.forEach((con) => this.addObservedChain(resizeSet, con.el, blockData.el));
    updateObserver(resizeSet, blockData.resizeSet, this.observer);
    blockData.resizeSet = resizeSet;
  }
  /**
   * Add `el` and every ancestor up to (and including) `root` to `set`.
   *
   * Mirrors `connectorUtil.addResize`: the elements between a connector and its block are the ones
   * whose size can move or resize the endpoint, so they are what the block's `ResizeObserver` has to
   * watch.
   *
   * @param {Set<Element>} set
   * @param {HTMLElement} el
   * @param {HTMLElement} root
   */
  addObservedChain(set, el, root) {
    let node = el;
    while (node) {
      set.add(node);
      if (node === root)
        return;
      node = node.parentElement;
    }
  }
  /**
   * Re-discover a block's connectors and refresh their positions, reporting the
   * moved ones through the batched `ne-move` queue (P3-2).
   *
   * Memoised: this is what the `ResizeObserver` handler calls for every block
   * in a resize batch, so it must not walk a block whose DOM did not change.
   *
   * @param {BlockData} blockData
   * @param {number} [changeTs] `ResizeObserver` batch stamp to compare
   *   `ConnectorData.changed` against (its connector box changed in this batch)
   */
  refreshBlockConnectors(blockData, changeTs) {
    this.recheckConnectors(blockData);
    blockData.connectorMap.forEach((con) => {
      let tmp = con.pos;
      recalcPos(con);
      if (pairChanged(tmp, con.pos) || changeTs && con.changed == changeTs)
        this.queueMove(con);
    });
  }
  /**
   * P3-1: the DOM of a block changed structurally (its `MutationObserver`
   * fired). Coalesce the burst of mutation records into ONE connector rescan
   * per task, so adding a list of connectors does not walk the subtree once per
   * inserted node.
   * @param {BlockData} blockData
   */
  scheduleConnectorRecheck(blockData) {
    let queue = this._recheckQueue || (this._recheckQueue = /* @__PURE__ */ new Set());
    queue.add(blockData);
    if (this._recheckScheduled)
      return;
    this._recheckScheduled = true;
    microtask(() => {
      this._recheckScheduled = false;
      let set = this._recheckQueue;
      this._recheckQueue = null;
      if (!set || this.destroyed)
        return;
      let changeTs = Date.now();
      set.forEach((b) => this.refreshBlockConnectors(b, changeTs));
    });
  }
  /**
   * P3-2: a connector moved. Moved connectors are not reported one event at a
   * time; they are queued and flushed as a single `ne-move` (see `flushMoves`).
   * @param {ConnectorData} con
   */
  queueMove(con) {
    let queue = this._moveQueue || (this._moveQueue = /* @__PURE__ */ new Set());
    queue.add(con);
    if (this._moveScheduled)
      return;
    this._moveScheduled = true;
    microtask(() => this.flushMoves());
  }
  /**
   * Fire the batched `ne-move` for every connector queued since the last flush.
   * One event on the editor element, `detail = { stamp, connectors }`:
   * `connectors` holds the same `{...ConnectorData}` snapshots the old
   * per-connector events carried (same shape, one entry instead of N) and
   * `stamp` is mirrored onto `con.movedStamp` so a listener can check whether
   * one of its connectors moved in O(1). Block-level `ne-move`/`ne-move-done`
   * (see `fireMove`) are unchanged.
   */
  flushMoves() {
    this._moveScheduled = false;
    let queue = this._moveQueue;
    if (!queue || !queue.size)
      return;
    this._moveQueue = null;
    if (this.destroyed)
      return;
    let stamp = (this._moveStamp || 0) + 1;
    this._moveStamp = stamp;
    let connectors = [];
    queue.forEach((con) => {
      con.movedStamp = stamp;
      connectors.push({ ...con });
    });
    this.fireCustom(this, "ne-move", { stamp, connectors });
  }
  /**
   *
   * @param {string} id
   * @returns {BlockData}
   */
  getBlockData(id) {
    if (typeof id === "string")
      return this.blockMap.get(id);
    if (isNode(id))
      return this.nodeMap.get(id);
    return id;
  }
  /**
   *
   * @param {string} nid
   * @returns {Array<number>}
   */
  getPos(nid) {
    return this.blockMap.get(nid)?.pos;
  }
  /**
   *
   * @param {string | Array<string>} blockId block id
   * @param {string} [cid] connector id
   * @returns {ConnectorData}
   */
  getConnector(blockId, cid) {
    if (blockId instanceof Array) {
      cid = blockId[1];
      blockId = blockId[0];
    } else if (!cid && blockId.includes("/")) {
      let idx = blockId.indexOf("/");
      cid = blockId.substring(idx + 1);
      blockId = blockId.substring(0, idx);
    }
    return this.blockMap.get(blockId)?.connectorMap.get(cid);
  }
  lineHasConnector(con) {
    for (let i = 0; i < this.lines.length; i++) {
      let tmp = this.lines[i];
      if (tmp.p1.con == con || tmp.p2.con == con)
        return true;
    }
    return false;
  }
  removeLine(line) {
    let idx = this.lines.indexOf(line);
    if (idx != -1) {
      if (this.selectedLine == line)
        this.selectedLine = null;
      this.lines.splice(idx, 1);
      this.lineLayer.remove(line);
      finalize(line);
      this.historyRecord("remove");
    }
  }
  /**
   * Remove a connector whose element has been detached from the DOM: drop it
   * from the block data, fire `ne-remove`, remove the lines connected to it
   * (same filter pattern removeBlock used) and finalize its listeners.
   * Idempotent — a second call for the same connector is a no-op, which keeps
   * it safe to run both from the IntersectionObserver callback and from
   * `removeBlock`.
   * @param {ConnectorData} con
   */
  removeConnector(con) {
    let blockData = con?.root;
    if (!blockData || blockData.connectorMap.get(con.id) !== con)
      return;
    blockData.connectorMap.delete(con.id);
    blockData.resizeSet.delete(con.el);
    this.observer?.unobserve?.(con.el);
    let lines = this.lines.filter((line) => line.p1.con?.idFull == con.idFull || line.p2.con?.idFull == con.idFull);
    this.fireCustom(con.el, "ne-remove", { ...con });
    lines.forEach((l) => this.removeLine(l));
    con.el.removeObserve?.();
    finalize(con);
  }
  removeBlock(block) {
    let idx = this.blocks.indexOf(block);
    if (idx != -1) {
      this.blocks.splice(idx, 1);
      this.blockMap.delete(block.id);
      this.nodeMap.delete(block.el);
      block.structDirty = false;
      block.connectorMap.forEach((con) => this.removeConnector(con));
      if (block.el.isConnected)
        remove(block.el);
      finalize(block);
      this.historyRecord("remove");
    }
  }
  getMinXY() {
    return getBlocksMinXY(this.blocks);
  }
  setZoomAndPos(zoom, x, y) {
    this.zoom = zoom;
    const [minx, miny] = this.getMinXY();
    this.moveAll(x - minx, y - miny);
  }
  resetView(padx = 30, pady = 30) {
    const [minx, miny] = this.getMinXY();
    this.moveAll(-minx + padx, -miny + pady);
    this.fireMoveDone();
  }
  moveAll(dx = 0, dy = 0) {
    this.blocks.forEach((blockData) => {
      let [x, y] = blockData.pos;
      this._setPos(blockData, [x + dx, y + dy]);
    });
  }
  setPos(nid, pos) {
    let blockData = this.getBlockData(nid);
    if (blockData)
      this._setPos(blockData, pos);
  }
  _setPos(blockData, pos) {
    blockData.pos = pos;
    blockData.connectorMap.forEach((con) => {
      updatePos(con);
      this.queueMove(con);
    });
    let style = blockData.el.style;
    style.setProperty("--ne-x", pos[0] + "px");
    style.setProperty("--ne-y", pos[1] + "px");
  }
  // #region zoom-defaults
  /**
   * @param {Object} [param]
   * @param {Function} [param.menu] menu generator, receives the selected blocks (see `menuGenerator`)
   * @param {number} [param.zoomMin] minimum zoom, default 0.3
   * @param {number} [param.zoomMax] maximum zoom, default 4 (zoom beyond 100% is allowed)
   * @param {number} [param.snap] grid size to snap block moves to, 0 = no snapping
   * @param {number} [param.nudgeStep] arrow-key nudge step in content units, Shift multiplies by 5
   * @param {Object<string, Function>} [param.typeMap] block factories, used by `loadGraph` and undo/redo
   */
  tpl({ menu = null, zoomMin = 0.3, zoomMax = 4, snap = 0, nudgeStep = 10, typeMap: typeMap2 = null, ...attr } = {}) {
    attr.tabindex = "0";
    super.tpl(attr);
    this.menuGenerator = menu;
    this.zoomMin = zoomMin;
    this.zoomMax = zoomMax;
    this.snap = snap;
    this.nudgeStep = nudgeStep;
    this.typeMap = typeMap2;
    this.undoStack = [];
    this.redoStack = [];
    this._histLast = null;
    this._histKind = null;
    this._histTs = 0;
    this._batchDepth = 0;
    this._loadingGraph = false;
    this._moveQueue = null;
    this._moveScheduled = false;
    this._moveStamp = 0;
    this._recheckQueue = null;
    this._recheckScheduled = false;
    this._structMO = null;
    this.lineinteraciton = new LineInteraction(this);
    const handler = (arr) => {
      let blocksChanged = /* @__PURE__ */ new Set();
      let consChanged = /* @__PURE__ */ new Set();
      let changeTs = Date.now();
      arr.forEach((e) => {
        let { target, contentRect, borderBoxSize } = e;
        let boxSize = borderBoxSize[0];
        let size = [boxSize.inlineSize, boxSize.blockSize];
        if (e.target == this) {
          this.realWidth = size[0];
          this.realHeight = size[1];
          this.updateSize();
          this.lineLayer.onResize(this.realWidth, this.realHeight);
          return;
        }
        if (target.ncData) {
          let ncData = target.ncData;
          if (pairChanged(size, ncData.size)) {
            ncData.size = size;
            ncData.changed = changeTs;
            consChanged.add(ncData);
          }
        } else if (target.neBlock) {
          let neBlock = target.neBlock;
          if (pairChanged(size, neBlock.size)) {
            neBlock.size = size;
            blocksChanged.add(neBlock);
          }
        } else {
          let neBlock;
          let p = target;
          while (p && !neBlock) {
            neBlock = p.neBlock;
            p = p.parentElement;
          }
          if (neBlock)
            blocksChanged.add(neBlock);
        }
      });
      blocksChanged.forEach((block) => this.refreshBlockConnectors(block, changeTs));
      consChanged.forEach((con) => {
        if (blocksChanged.has(con.root))
          return;
        recalcPos(con);
        this.queueMove(con);
      });
    };
    this.observer = new ResizeObserver(handler);
    this.observer.observe(this);
    this.svgLayer = hSvg("svg", { class: "ne-svg-layer" });
    this.contentArea = /* @__PURE__ */ jsx("div", { class: "ne-canvas", children: this.svgLayer });
    this._zoom = 1;
    this.lineLayer = createSvgLineLayer(this);
    this.ensureStructObserver();
    this.zoomUI = /* @__PURE__ */ jsx("div", { class: "ne-zoom-ui", children: [
      /* @__PURE__ */ jsx("div", { class: "ne-zoom-bt", title: "Zoom out", onclick: () => this.zoomTo(this.zoom / 1.25), children: "\u2212" }),
      /* @__PURE__ */ jsx("div", { class: "ne-zoom-bt ne-zoom-val", title: "Reset zoom to 100%", onclick: () => this.zoomTo(1) }),
      /* @__PURE__ */ jsx("div", { class: "ne-zoom-bt", title: "Zoom in", onclick: () => this.zoomTo(this.zoom * 1.25), children: "+" })
    ] });
    this.zoomLabel = this.zoomUI.children[1];
    insert(this, this.zoomUI);
    this.updateZoomUI();
    let el = this.contentArea;
    const { $s } = this;
    this.$focusOrSelecting = $Or($s.isDown, $s.hasFocus);
    observeNow(this.$focusOrSelecting, (f) => classIf(el, "focused", f));
    let lx = 0;
    let ly = 0;
    let domNode;
    let nid;
    let blockData;
    let ignore;
    let downButton = 0;
    let dragList = null;
    let dragStart = null;
    let marqueeEl = null;
    let marqueeStart = null;
    let marqueeCur = null;
    const updateMarquee = () => {
      let st = marqueeEl.style;
      st.setProperty("--ne-marquee-x", Math.min(marqueeStart[0], marqueeCur[0]) + "px");
      st.setProperty("--ne-marquee-y", Math.min(marqueeStart[1], marqueeCur[1]) + "px");
      st.setProperty("--ne-marquee-w", Math.abs(marqueeCur[0] - marqueeStart[0]) + "px");
      st.setProperty("--ne-marquee-h", Math.abs(marqueeCur[1] - marqueeStart[1]) + "px");
    };
    let dragRaf = 0;
    let dragDelta = null;
    let panRaf = 0;
    let panDelta = null;
    let marqueeRaf = 0;
    const applyDrag = () => {
      if (dragRaf) {
        cancelAnimationFrame(dragRaf);
        dragRaf = 0;
      }
      if (!dragDelta)
        return;
      let d = dragDelta;
      dragDelta = null;
      if (!blockData || !dragList)
        return;
      for (let i = 0; i < dragList.length; i++) {
        this._setPos(dragList[i], [dragStart[i][0] + d[0], dragStart[i][1] + d[1]]);
      }
      let menu2 = this.currentMenu;
      if (menu2)
        moveMenu(dragList, menu2, this._zoom);
      this.fireMove(blockData);
    };
    const applyPan = () => {
      if (panRaf) {
        cancelAnimationFrame(panRaf);
        panRaf = 0;
      }
      if (!panDelta)
        return;
      let d = panDelta;
      panDelta = null;
      if (d[0] || d[1])
        this.moveAll(d[0], d[1]);
    };
    const flushMarquee = () => {
      if (!marqueeRaf)
        return;
      cancelAnimationFrame(marqueeRaf);
      marqueeRaf = 0;
      if (marqueeEl)
        updateMarquee();
    };
    el.addEventListener("dragstart", (e) => {
      if (blockData)
        e.preventDefault();
    });
    el.addEventListener("pointerdown", (e) => {
      ignore = false;
      if (e.button === 2) {
        ignore = true;
        return;
      }
      let hasDrag;
      let hasBlock;
      let insideMenu;
      domNode = findParent(e.target, (p) => {
        if (!p.hasAttribute)
          return false;
        if (p.hasAttribute("ne-drag"))
          hasDrag = true;
        if (p.hasAttribute("ne-nodrag"))
          hasBlock = true;
        if (p == this.currentMenu) {
          insideMenu = true;
          ignore = true;
          return true;
        }
        return p.hasAttribute("nid");
      });
      if (!hasDrag && domNode || hasBlock || insideMenu)
        return;
      downButton = e.button || 0;
      if (domNode) {
        nid = getAttr(domNode, "nid");
        blockData = this.getBlockData(nid);
      } else {
        blockData = void 0;
      }
      if (downButton)
        e.preventDefault();
      lx = e.clientX;
      ly = e.clientY;
      if (dragRaf) {
        cancelAnimationFrame(dragRaf);
        dragRaf = 0;
      }
      if (panRaf) {
        cancelAnimationFrame(panRaf);
        panRaf = 0;
      }
      if (marqueeRaf) {
        cancelAnimationFrame(marqueeRaf);
        marqueeRaf = 0;
      }
      dragDelta = null;
      panDelta = null;
      $s.isDown = true;
    });
    el.addEventListener("pointerup", (e) => {
      if (ignore) {
        ignore = false;
        return;
      }
      if (!$s.isDown()) {
        this.deselect();
        return;
      }
      let wasMoving = $s.isMoving();
      $s.isDown = false;
      if (wasMoving)
        el.releasePointerCapture(e.pointerId);
      $s.isMoving = false;
      applyDrag();
      applyPan();
      flushMarquee();
      this.fireMoveDone(blockData, marqueeEl ? "select" : "move");
      if (wasMoving && marqueeEl) {
        let [mx, my] = this.contentPoint(e.clientX, e.clientY);
        let hit = this.blocksInRect(marqueeStart[0], marqueeStart[1], mx, my);
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          hit = [...this.selectedBlocks || []];
          this.blocksInRect(marqueeStart[0], marqueeStart[1], mx, my).forEach((b) => {
            if (!hit.includes(b))
              hit.push(b);
          });
        }
        this.selectBlocks(hit);
        e.preventDefault();
      } else if (wasMoving) {
        e.preventDefault();
      } else if (domNode == null) {
        this.deselect();
      } else if (blockData) {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          this.toggleBlockSelection(blockData);
        } else {
          this.selectBlocks([blockData]);
        }
      }
      if (marqueeEl) {
        remove(marqueeEl);
        marqueeEl = null;
      }
      blockData = domNode = nid = void 0;
      dragList = dragStart = null;
    });
    el.addEventListener("pointermove", (e) => {
      if (ignore)
        return;
      if (!$s.isDown())
        return;
      if (!$s.isMoving()) {
        el.setPointerCapture(e.pointerId);
        $s.isMoving = true;
        if (blockData) {
          let sel = this.selectedBlocks || [];
          if (sel.includes(blockData)) {
            dragList = [blockData, ...sel.filter((b) => b != blockData)];
          } else {
            this.selectBlocks([blockData]);
            dragList = [blockData];
          }
          dragStart = dragList.map((b) => [b.pos[0], b.pos[1]]);
        } else {
          let menu2 = this.currentMenu;
          if (menu2)
            setVisible(menu2, false);
          if (downButton === 0 && !e.altKey && !e.ctrlKey && !e.metaKey) {
            marqueeStart = this.contentPoint(lx, ly);
            marqueeCur = [...marqueeStart];
            marqueeEl = /* @__PURE__ */ jsx("div", { class: "ne-marquee" });
            insert(this.contentArea, marqueeEl);
            updateMarquee();
          }
        }
        window.getSelection().removeAllRanges();
        this.focus();
      }
      if (blockData) {
        let [x0, y0] = dragStart[0];
        let nx = x0 + (-lx + e.clientX) / this._zoom;
        let ny = y0 + (-ly + e.clientY) / this._zoom;
        if (this.snap) {
          nx = Math.round(nx / this.snap) * this.snap;
          ny = Math.round(ny / this.snap) * this.snap;
        }
        dragDelta = [nx - x0, ny - y0];
        if (!dragRaf)
          dragRaf = requestAnimationFrame(() => {
            dragRaf = 0;
            applyDrag();
          });
      } else if (marqueeEl) {
        marqueeCur = this.contentPoint(e.clientX, e.clientY);
        if (!marqueeRaf)
          marqueeRaf = requestAnimationFrame(() => {
            marqueeRaf = 0;
            updateMarquee();
          });
      } else {
        let dx = (-lx + e.clientX) / this._zoom;
        let dy = (-ly + e.clientY) / this._zoom;
        lx = e.clientX;
        ly = e.clientY;
        if (!panDelta)
          panDelta = [0, 0];
        panDelta[0] += dx;
        panDelta[1] += dy;
        if (!panRaf)
          panRaf = requestAnimationFrame(() => {
            panRaf = 0;
            applyPan();
          });
      }
    });
    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (this.currentMenu && findParent(e.target, (p) => p == this.currentMenu))
        return;
      let node = findParent(e.target, (p) => p.hasAttribute && p.hasAttribute("nid"));
      if (node) {
        let bd = this.getBlockData(getAttr(node, "nid"));
        if (!bd)
          return;
        if (!(this.selectedBlocks || []).includes(bd))
          this.selectBlocks([bd]);
        this.placeMenuAtCursor(e);
        return;
      }
      let g = findParent(e.target, (p) => p.tagName == "g");
      let line = g && this.lines.find((l) => l.el == g) || this.lineLayer.pick(e.clientX, e.clientY);
      if (line) {
        this.selectConnector(line);
        let menu2 = this.menuGenerator?.([]);
        if (menu2) {
          if (this.currentMenu && this.currentMenu != menu2)
            setVisible(this.currentMenu, false);
          setVisible(menu2, true);
          if (!menu2.parentNode) {
            insert(this.contentArea, menu2);
          }
          this.currentMenu = menu2;
          this.placeMenuAtCursor(e);
        }
        return;
      }
      this.deselect();
    });
    const keypress = (e) => {
      let active = document.activeElement;
      if (active && active.isContentEditable)
        return;
      let key = e.key;
      let mod = e.ctrlKey || e.metaKey;
      if (mod) {
        switch (key.toLowerCase()) {
          case "z":
            e.preventDefault();
            if (e.shiftKey)
              this.redo();
            else
              this.undo();
            return;
          case "y":
            e.preventDefault();
            this.redo();
            return;
          case "a":
            e.preventDefault();
            this.selectAll();
            return;
          case "=":
          case "+":
            e.preventDefault();
            this.zoomTo(this.zoom * 1.25);
            return;
          case "-":
          case "_":
            e.preventDefault();
            this.zoomTo(this.zoom / 1.25);
            return;
          case "0":
            e.preventDefault();
            this.zoomTo(1);
            return;
        }
      } else if (key === "Escape") {
        this.deselect();
        return;
      } else if (key === "Enter" || key === " ") {
        let bd = e.target !== this ? this.getBlockData(e.target) : null;
        if (bd) {
          this.selectBlocks([bd]);
          e.preventDefault();
          return;
        }
        let g = findParent(e.target, (p) => p.tagName == "g");
        let line = g && this.lines.find((l) => l.el == g) || this.lineLayer.pick(e.clientX, e.clientY);
        if (line) {
          this.selectConnector(line);
          e.preventDefault();
        }
        return;
      }
      if ((key === "Delete" || key === "Backspace") && this.$focusOrSelecting()) {
        this.deleteSelection();
        e.preventDefault();
        return;
      }
      if (this.$focusOrSelecting()) {
        let dx = key == "ArrowLeft" ? -1 : key == "ArrowRight" ? 1 : 0;
        let dy = key == "ArrowUp" ? -1 : key == "ArrowDown" ? 1 : 0;
        if (dx || dy) {
          e.preventDefault();
          let step = this.nudgeStep * (e.shiftKey ? 5 : 1);
          this.nudgeSelection(dx * step, dy * step);
        }
      }
    };
    listen(this, "keydown", keypress);
    this.onfocus = (e) => $s.hasFocus = true;
    this.onblur = (e) => $s.hasFocus = false;
    listen(this, "focusin", () => $s.hasFocus = true);
    listen(this, "focusout", (e) => {
      if (!this.contains(e.relatedTarget))
        $s.hasFocus = false;
    });
    return this.contentArea;
  }
  get zoom() {
    return this._zoom;
  }
  set zoom(zoom) {
    zoom = this.clampZoom(zoom);
    if (this._zoom == zoom)
      return;
    this._zoom = zoom;
    this.contentArea.style.setProperty("--ne-zoom", String(zoom));
    this.lineLayer.onViewport(zoom);
    this.updateSize();
    this.updateZoomUI();
  }
  updateSize() {
    let style = this.contentArea.style;
    style.setProperty("--ne-zoom-w", this.realWidth / this._zoom + "px");
    style.setProperty("--ne-zoom-h", this.realHeight / this._zoom + "px");
  }
  changeZoomMouse(zoom, e) {
    const rect = this.getBoundingClientRect();
    this.changeZoom(zoom, e.clientX - rect.x, e.clientY - rect.y);
  }
  changeZoomCenter(zoom) {
    this.changeZoom(zoom, this.realWidth / 2, this.realHeight / 2);
  }
  changeZoom(delta, x = 0, y = 0) {
    const recenter = !!x || !!y;
    let zoom = this._zoom;
    let relx, rely;
    if (recenter) {
      relx = x / zoom;
      rely = y / zoom;
    }
    let newZoom = this.clampZoom(zoom + delta);
    if (newZoom != zoom) {
      if (recenter) {
        let relx2 = x / newZoom;
        let rely2 = y / newZoom;
        this.moveAll(relx2 - relx, rely2 - rely);
        this.fireMoveDone(null, "zoom");
      }
      this.zoom = newZoom;
    }
  }
  /**
   * Clamp a zoom value into the `[zoomMin, zoomMax]` range. Values within
   * float dust (1e-9) of a bound snap to it, so accumulated wheel steps land
   * exactly on `zoomMin`/`zoomMax`.
   * @param {number} zoom
   * @returns {number}
   */
  clampZoom(zoom) {
    let lo = this.zoomMin;
    let hi = this.zoomMax;
    if (zoom <= lo || zoom - lo < 1e-9)
      return lo;
    if (zoom >= hi || hi - zoom < 1e-9)
      return hi;
    return zoom;
  }
  /**
   * Zoom to an absolute level (clamped to `zoomMin`/`zoomMax`), centered on the
   * middle of the editor. Used by the zoom controls and Ctrl+/-/0 keys.
   * @param {number} zoom
   */
  zoomTo(zoom) {
    this.changeZoomCenter(this.clampZoom(zoom) - this._zoom);
  }
  updateZoomUI() {
    if (this.zoomLabel)
      this.zoomLabel.textContent = Math.round(this._zoom * 100) + "%";
    if (this.zoomUI) {
      classIf(this.zoomUI, "at-min", this._zoom <= this.zoomMin);
      classIf(this.zoomUI, "at-max", this._zoom >= this.zoomMax);
    }
  }
  clear() {
    this.deleteBlocks([...this.blocks]);
    this.selectBlocks([]);
  }
  deleteSelectedBlocks() {
    this.deleteBlocks([...this.selectedBlocks]);
    this.selectBlocks([]);
  }
  deleteBlocks(blocks) {
    this._batchDepth++;
    try {
      blocks.forEach((block) => {
        this.removeBlock(block);
      });
    } finally {
      this._batchDepth--;
      if (!this._batchDepth)
        this.historyRecord("remove");
    }
  }
  /**
   * @param {string} idFull1
   * @param {string} idFull2
   * @returns {boolean} true when a line already connects the two connectors (in either direction)
   */
  lineExists(idFull1, idFull2) {
    for (let i = 0; i < this.lines.length; i++) {
      let tmp = this.lines[i];
      let a = tmp.p1.con?.idFull;
      let b = tmp.p2.con?.idFull;
      if (a == idFull1 && b == idFull2 || a == idFull2 && b == idFull1)
        return true;
    }
    return false;
  }
  /**
   * @param {string|Array<string>} c1
   * @param {string|Array<string>} c2
   * @returns {ConnectLine}
   * @throws {Error} when either connector is unknown, they are the same connector,
   *   or a line already connects the pair (in either direction)
   */
  addConnectorFromTo(c1, c2) {
    let con1 = this.getConnector(c1);
    let con2 = this.getConnector(c2);
    if (!con1)
      con1 = this.getConnectorAfterRescan(c1);
    if (!con2)
      con2 = this.getConnectorAfterRescan(c2);
    if (!con1 || !con2)
      throw new Error(`NodeEditor: ${this.describeMissingConnector(c1, con1, c2, con2)}`);
    if (con1 == con2)
      throw new Error(`NodeEditor: cannot connect a connector to itself: "${con1.idFull}"`);
    if (this.lineExists(con1.idFull, con2.idFull))
      throw new Error(`NodeEditor: "${con1.idFull}" is already connected to "${con2.idFull}"`);
    let path = new ConnectLine();
    path.setPoint1(con1, false);
    path.setPoint2(con2);
    let con = this.addConnector(path);
    this.historyRecord("line");
    return con;
  }
  /**
   * Look a connector up again after forcing a rescan of the block it belongs to.
   *
   * Used only when a plain lookup failed, so a host that renders connectors asynchronously (or in
   * the same task as the lookup) still gets its lines. The id is `"blockId/ncid"`; an array or an
   * object form has no block name to rescan and is left to the caller's error.
   *
   * @param {string|Array<string>} ref
   * @returns {ConnectorData | undefined}
   */
  getConnectorAfterRescan(ref) {
    if (typeof ref !== "string" || !ref.includes("/"))
      return void 0;
    let blockId = ref.slice(0, ref.indexOf("/"));
    let blockData = this.blockMap.get(blockId);
    if (!blockData)
      return void 0;
    this.recheckConnectors(blockData, true);
    return this.getConnector(ref);
  }
  /**
   * Explain why a block's connectors are (or are not) discovered.
   *
   * Walks the block element for `[ncid]` exactly like discovery does and reports, per element, the
   * `ncid`, the direction, and whether the editor collected it — plus why not, when it did not.
   * Intended for the common "my connector does not show up" case: the usual causes are an `ncid`
   * inside a shadow root (never traversed), a connector element outside the block element, and a
   * **duplicate `ncid`** (only the first element with an id becomes the connector; the second is
   * ignored and also does not get the `ne-nodrag` marker, so it drags the block instead).
   *
   * @param {string|BlockData} block
   * @returns {Array<{ ncid: string|null, collected: boolean, dir: string|null, tag: string, note?: string }>}
   */
  explainConnectors(block) {
    let blockData = this.getBlockData(block);
    if (!blockData)
      return [];
    let found = [];
    let walk = (el) => {
      let ncid = getAttr(el, "ncid");
      if (ncid) {
        let collected = blockData.connectorMap.get(ncid)?.el === el;
        let note;
        if (!collected && blockData.connectorMap.has(ncid))
          note = "duplicate ncid \u2014 another element holds it";
        else if (!collected)
          note = "not collected by the last scan";
        found.push({
          ncid: typeof ncid === "string" ? ncid : String(ncid),
          collected,
          dir: getAttr(el, "ne-connect"),
          tag: el.tagName,
          ...note ? { note } : {}
        });
      }
      for (let child = el.firstElementChild; child; child = child.nextElementSibling)
        walk(child);
    };
    walk(blockData.el);
    return found;
  }
  /**
   * Build the "connector not found" message.
   *
   * A bare `unknown connector: "1/o1"` does not say *why*, and the usual cause is host-side: the
   * block's markup has not rendered its connectors yet (or it renders them with a different `ncid`).
   * So the message names the block, lists the connectors that WERE discovered, and says whether the
   * block exists at all.
   *
   * @param {string|Array<string>} c1
   * @param {ConnectorData|undefined} con1
   * @param {string|Array<string>} c2
   * @param {ConnectorData|undefined} con2
   * @returns {string}
   */
  describeMissingConnector(c1, con1, c2, con2) {
    let parts = [];
    for (const [ref, con] of [
      [c1, con1],
      [c2, con2]
    ]) {
      if (con)
        continue;
      let name = Array.isArray(ref) ? ref.join("/") : String(ref);
      let blockId = typeof ref === "string" && ref.includes("/") ? ref.slice(0, ref.indexOf("/")) : null;
      let blockData = blockId ? this.blockMap.get(blockId) : null;
      if (blockData) {
        let known = [...blockData.connectorMap.keys()];
        parts.push(
          `"${name}" does not exist in block "${blockData.id}" (type "${blockData.type}"); discovered there: ${known.length ? known.map((k) => `"${k}"`).join(", ") : "none"}`
        );
      } else {
        parts.push(`"${name}" does not exist (no block "${blockId ?? "?"}" registered)`);
      }
    }
    return `unknown connector: ${parts.join("; ")}`;
  }
  /**
   * Re-attach the lines that use a connector whose ELEMENT was replaced (see `findConnector`).
   *
   * A line holds its endpoint as a `ConnectorData` object plus listeners bound to
   * `con.el` (`ne-remove` in `ConnectLine.setPoint`), and a `ne-move` subscription per endpoint. When
   * a host re-renders a port — the usual data-driven flow, where blocks are added first and their
   * ports arrive with the async data — the old listeners die with the old element, so the lines must
   * be re-pointed at the same `ConnectorData` (its `el` has already been updated in place).
   *
   * Idempotent: `setPoint` releases the previous listeners before installing new ones.
   *
   * @param {ConnectorData} con
   */
  reattachLines(con) {
    this.lines.forEach((line) => {
      if (line.p1.con === con)
        line.setPoint(line.p1, con, true);
      if (line.p2.con === con)
        line.setPoint(line.p2, con, true);
    });
  }
  /**
   * @param {ConnectLine} con
   */
  addConnector(con) {
    this.lineLayer.add(con);
    this.lines.push(con);
    return con;
  }
  /**
   * @typedef GraphState
   * @property {Array<{id: string, type: string, pos: Array<number>}>} blocks
   * @property {Array<[string, string]>} lines
   */
  /**
   * Serialize the whole graph to a plain JSON-compatible object: `blocks` as
   * `{id, type, pos}` and `lines` as pairs of connector ids
   * (`ConnectorData.idFull`, `"blockId/ncid"`). The result is suitable for
   * `JSON.stringify` (the demo stores it in `localStorage`).
   * @returns {GraphState}
   */
  saveGraph() {
    return {
      // pos arrays are COPIED: undo/redo keeps snapshots of live block data
      blocks: this.blocks.map((b) => ({ id: b.id, type: b.type, pos: [b.pos[0], b.pos[1]] })),
      lines: this.lines.map((l) => [l.p1.con?.idFull, l.p2.con?.idFull])
    };
  }
  /**
   * Rebuild the graph from a saved state (as produced by `saveGraph`),
   * clearing the editor first.
   *
   * `typeMap` maps a block `type` to a factory **that receives the block's own data** and returns a
   * FRESH block element: `{ Switch: ({ id, type, ...data }) => <Switch id={id} {...data} /> }`. The
   * editor does not know block components itself, and it never builds block markup — rendering it
   * from the provided data is the host's job, which is why the descriptor is passed through.
   * Extra keys on a block entry arrive in the factory untouched (a host that needs custom per-block
   * data can put it there and read it back in the factory).
   *
   * Lines are wired **after** every block has been added, so a factory that renders connectors
   * synchronously gets them discovered before any line refers to them. A factory that renders
   * asynchronously must be awaited by the host: load blocks first, then call
   * [inspectConnectors](#inspectConnectors), then add the lines (see the README).
   *
   * **Bad line entries are skipped, not fatal** — see [loadLines](#loadLines): each one is reported
   * to the console and the remaining lines still attach, so corrupt data cannot blank a document.
   *
   * The undo/redo baseline is reset afterwards: loading is not an "edit".
   *
   * @param {GraphState} state
   * @param {Object<string, Function>} [typeMap]
   * @throws {Error} when a block type has no factory in `typeMap`
   */
  loadGraph(state, typeMap2 = this.typeMap) {
    this._loadingGraph = true;
    try {
      this.clear();
      for (let b of state?.blocks ?? []) {
        let make = typeMap2?.[b.type];
        if (typeof make !== "function")
          throw new Error(`NodeEditor: no factory registered for block type "${b.type}" (id "${b.id}")`);
        this.add(make(b), b.id, { pos: [b.pos[0], b.pos[1]], type: b.type });
      }
      this.inspectConnectors();
      this.loadLines(state?.lines);
    } finally {
      this._loadingGraph = false;
    }
    this.historyReset();
  }
  /**
   * Wire the lines of a loaded graph, tolerating bad entries.
   *
   * One line that cannot be attached (a connector the block markup does not have, a duplicate, a
   * self-connection) must not cost the whole document: the editor reports it to the console with the
   * same detail as the strict error and continues with the remaining lines. That matters for
   * data-driven diagrams, where the block markup comes from the host and stale or corrupt line data
   * is a normal occurrence.
   *
   * `addConnectorFromTo` stays strict on purpose: it is also the interactive path (a host wiring one
   * line from user input), where failing loudly is the right behaviour.
   *
   * @param {Array<[string, string]>} [lines]
   * @returns {{ attached: number, skipped: number }}
   */
  loadLines(lines) {
    let attached = 0;
    let skipped = 0;
    for (let entry of lines ?? []) {
      let [c1, c2] = Array.isArray(entry) ? entry : [void 0, void 0];
      try {
        this.addConnectorFromTo(c1, c2);
        attached++;
      } catch (err) {
        skipped++;
        console.error(`NodeEditor: skipping line ${JSON.stringify(entry)} \u2014 ${err.message}`);
      }
    }
    return { attached, skipped };
  }
  /**
   * Inspect the rendered blocks and (re)discover their connectors.
   *
   * This is the explicit middle step of the data-driven flow: the host renders the block markup from
   * its data, calls this, and only then wires lines — so the connectors are guaranteed to be in the
   * map no matter how the markup was produced. Every block is force-scanned, so it is safe to call
   * after an asynchronous render as well.
   *
   * @returns {Array<{ blockId: string, id: string, idFull: string, dir: string, el: HTMLElement }>}
   *   every connector currently discovered, in block order
   */
  inspectConnectors() {
    let found = [];
    this.blocks.forEach((blockData) => {
      this.recheckConnectors(blockData, true);
      blockData.connectorMap.forEach((con) => {
        found.push({ blockId: blockData.id, id: con.id, idFull: con.idFull, dir: con.dir, el: con.el });
      });
    });
    return found;
  }
  /**
   * The connectors discovered in one block, as `id -> ConnectorData`.
   *
   * Use it to validate host data before wiring lines (`editor.getConnectors(id).has('o1')`), or to
   * build a connector list for the user.
   *
   * @param {string|BlockData} block id or `BlockData`
   * @returns {Map<string, ConnectorData>}
   */
  getConnectors(block) {
    let blockData = this.getBlockData(block);
    return blockData ? blockData.connectorMap : /* @__PURE__ */ new Map();
  }
  /**
   * Undo/redo snapshots reuse the P1 `{blocks, lines}` serialization.
   * `historyRecord` runs on the mutating events (`add`, `removeBlock`,
   * `removeLine`, `addConnectorFromTo`, `fireMoveDone`, line-connect): it
   * snapshots the CURRENT graph and only pushes an undo entry when the
   * snapshot actually differs from the previous one. `kind` merges rapid
   * sequences (wheel zoom steps, key-repeat nudges) into a single undo step.
   * @param {string} kind
   */
  historyRecord(kind = "change") {
    if (this.destroyed || this._loadingGraph || this._batchDepth > 0)
      return;
    let state = this.saveGraph();
    let ser = JSON.stringify(state);
    if (this._histLast) {
      if (ser == this._histLast.ser)
        return;
      let merge = kind == this._histKind && (kind == "zoom" || kind == "nudge") && Date.now() - this._histTs < 750;
      if (!merge) {
        this.undoStack.push(this._histLast);
        if (this.undoStack.length > 100)
          this.undoStack.shift();
        this.redoStack.length = 0;
      }
    }
    this._histLast = { state, ser };
    this._histKind = kind;
    this._histTs = Date.now();
  }
  /** Set the recorded snapshot baseline to the current graph (creates no undo entry). */
  historyReset() {
    let state = this.saveGraph();
    this._histLast = { state, ser: JSON.stringify(state) };
    this._histKind = null;
    this._histTs = 0;
  }
  /**
   * Undo the last recorded change. Restoring reuses `loadGraph`, so the
   * editor needs its `typeMap` (block factories).
   * @returns {boolean} false when there is nothing to undo or `typeMap` is missing
   */
  undo() {
    if (!this.undoStack.length)
      return false;
    if (!this.typeMap) {
      console.warn("NodeEditor: undo() requires editor.typeMap to rebuild blocks");
      return false;
    }
    this.redoStack.push(this._histLast);
    this._histLast = this.undoStack.pop();
    this._histKind = null;
    this.loadGraph(this._histLast.state, this.typeMap);
    return true;
  }
  /**
   * Redo the last undone change (see `undo` for the `typeMap` requirement).
   * @returns {boolean}
   */
  redo() {
    if (!this.redoStack.length)
      return false;
    if (!this.typeMap) {
      console.warn("NodeEditor: redo() requires editor.typeMap to rebuild blocks");
      return false;
    }
    this.undoStack.push(this._histLast);
    this._histLast = this.redoStack.pop();
    this._histKind = null;
    this.loadGraph(this._histLast.state, this.typeMap);
    return true;
  }
  /**
   *
   * @param {*} blocks
   */
  selectBlocks(blocks) {
    this.selectedBlocks = blocks;
    let old = this.currentMenu;
    let menu;
    let blockIdMap = {};
    if (blocks.length) {
      blocks.forEach((b) => {
        blockIdMap[b.id] = 1;
      });
      this.selectConnector(null);
      menu = this.menuGenerator?.(blocks);
      if (old && old != menu)
        setVisible(old, false);
      if (menu) {
        setVisible(menu, true);
        if (menu != old) {
          insert(this.contentArea, menu);
        }
        moveMenu(blocks, menu, this._zoom);
      }
    } else {
      if (old)
        setVisible(old, false);
    }
    this.currentMenu = menu;
    let selSet = new Set(blocks);
    this.blocks.forEach((p) => {
      let block = p.block;
      let sel = selSet.has(p);
      if (block.setSelected) {
        block.setSelected(sel);
      } else {
        setSelected(block, sel);
      }
      this.setBlockLabel(p, sel);
    });
    this.lines.forEach((l) => {
      this.lineLayer.setStates(l, l.selected, !!blockIdMap[l.p1.con?.root.id], !!blockIdMap[l.p2.con?.root.id]);
    });
  }
  selectConnector(con) {
    if (con)
      this.selectBlocks([]);
    this.selectedLine = con;
    this.lines.forEach((p) => {
      p.setSelected(p == con);
      this.lineLayer.setStates(p, p == con, false, false);
    });
  }
  deselect() {
    this.selectConnector();
    this.selectBlocks([]);
  }
  /**
   * Swap the line layer: release the current one, hand the live lines to the
   * new one and re-apply the current selection states.
   *
   * The default layer is the SVG layer created in the constructor. A host with
   * WebGPU installs the canvas layer like this (both from `./canvasLineLayer.js`):
   *
   *   const lr = await loadLineRender()
   *   if (lr) editor.setLineLayer(makeCanvasLineLayer(editor, lr))
   *
   * The swap is immediate; in canvas mode drawing starts when the GPU
   * initialises (`layer.ready`) and the canvas stays blank until then, but
   * `pick()` works from the start (pure curve math). Switching back to the
   * SVG layer is the same call: `editor.setLineLayer(createSvgLineLayer(editor))`.
   *
   * @param {LineLayer} layer
   */
  setLineLayer(layer) {
    if (!layer || layer == this.lineLayer || this.destroyed)
      return;
    const old = this.lineLayer;
    this.lines.forEach((l) => old.remove(l));
    old.dispose();
    this.lineLayer = layer;
    layer.onViewport(this._zoom);
    layer.onResize(this.realWidth, this.realHeight);
    const selIds = new Set((this.selectedBlocks || []).map((b) => b.id));
    this.lines.forEach((l) => {
      layer.add(l);
      layer.setStates(l, l.selected, !!selIds.has(l.p1.con?.root.id), !!selIds.has(l.p2.con?.root.id));
    });
  }
  /**
   * Shift/Ctrl-click support: toggle one block in the selection.
   * @param {BlockData} block
   */
  toggleBlockSelection(block) {
    let list = (this.selectedBlocks || []).slice();
    let idx = list.indexOf(block);
    if (idx >= 0)
      list.splice(idx, 1);
    else
      list.push(block);
    this.selectBlocks(list);
  }
  /** Select all blocks (Ctrl+A). */
  selectAll() {
    this.selectBlocks([...this.blocks]);
  }
  /** Delete the current selection: the selected line, or the selected blocks. */
  deleteSelection() {
    if (this.selectedLine) {
      this.removeLine(this.selectedLine);
    } else if (this.selectedBlocks?.length) {
      this.deleteSelectedBlocks();
    }
  }
  /**
   * All blocks whose rectangle INTERSECTS the given content-space rectangle
   * (marquee selection: touching counts as inside).
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @returns {Array<BlockData>}
   */
  blocksInRect(x1, y1, x2, y2) {
    let minx = Math.min(x1, x2);
    let maxx = Math.max(x1, x2);
    let miny = Math.min(y1, y2);
    let maxy = Math.max(y1, y2);
    return this.blocks.filter((b) => {
      let [w, h2] = b.size;
      return b.pos[0] < maxx && b.pos[0] + w > minx && b.pos[1] < maxy && b.pos[1] + h2 > miny;
    });
  }
  /**
   * Viewport (client) coordinates to content-area coordinates (zoom-aware).
   * @param {number} clientX
   * @param {number} clientY
   * @returns {Array<number>}
   */
  contentPoint(clientX, clientY) {
    let rect = this.getBoundingClientRect();
    return [(clientX - rect.x) / this._zoom, (clientY - rect.y) / this._zoom];
  }
  /**
   * Move the selection by (dx, dy) content units, applying grid snapping
   * relative to the primary block when `snap` is on.
   * @param {number} dx
   * @param {number} dy
   */
  nudgeSelection(dx, dy) {
    let sel = this.selectedBlocks;
    if (!sel?.length)
      return;
    let [x0, y0] = sel[0].pos;
    let nx = x0 + dx;
    let ny = y0 + dy;
    if (this.snap) {
      nx = Math.round(nx / this.snap) * this.snap;
      ny = Math.round(ny / this.snap) * this.snap;
    }
    dx = nx - x0;
    dy = ny - y0;
    sel.forEach((b) => this._setPos(b, [b.pos[0] + dx, b.pos[1] + dy]));
    this.fireMoveDone(sel[0], "nudge");
  }
  /**
   * Position the current selection menu at a client point (right-click opens
   * the menu at the cursor instead of above the block).
   * @param {MouseEvent} e
   */
  placeMenuAtCursor(e) {
    let menu = this.currentMenu;
    if (!menu)
      return;
    setVisible(menu, true);
    let [x, y] = this.contentPoint(e.clientX, e.clientY);
    menu.style.setProperty("--ne-menu-x", x + "px");
    menu.style.setProperty("--ne-menu-y", y + "px");
  }
  /**
   * Accessible NAME of a block: type + id, and nothing else.
   *
   * The name must not change with selection. An earlier version appended `" selected"` here, which
   * made the block's accessible name change on every click — an `aria-label` is a name, not a place
   * for state, and selection is already carried by the `selected` attribute. The `selected` argument
   * is still accepted so existing callers do not have to change.
   *
   * @param {BlockData} blockData
   * @param {boolean} [selected] ignored — kept for call-site compatibility
   */
  setBlockLabel(blockData, selected) {
    let { id, type, el } = blockData;
    el.setAttribute("aria-label", `${type || "block"} ${id}`);
  }
  /**
   * Kept as a no-op for backward compatibility.
   *
   * It used to write a selection message ("block 1 selected", "selection cleared") into an
   * `aria-live` region that the editor inserted into itself. That region was only visually hidden by
   * the stylesheet, so a host that did not load it got the sentence as literal text on the canvas —
   * and the announcements themselves were never requested. Selection is conveyed by the `selected`
   * attribute/stroke.
   *
   * @param {string} [msg] ignored
   */
  setAriaStatus(msg) {
  }
  /** @type {boolean} */
  destroyed = false;
  /**
   * Tear down the editor: disconnect the canvas ResizeObserver, finalize all
   * lines and blocks (their listeners) and drop the selection. Idempotent —
   * safe to call again; also called automatically when the element leaves
   * the DOM (see `disconnectedCallback`).
   */
  destroy() {
    if (this.destroyed)
      return;
    this.destroyed = true;
    for (let i = this.lines.length - 1; i >= 0; i--)
      this.removeLine(this.lines[i]);
    for (let i = this.blocks.length - 1; i >= 0; i--)
      this.removeBlock(this.blocks[i]);
    this.lineLayer.dispose();
    this.selectedLine = null;
    this.selectedBlocks = [];
    let menu = this.currentMenu;
    if (menu) {
      menu._neMenuObs?.disconnect();
      menu._neMenuObs = null;
      menu._neMenuSize = null;
    }
    this.currentMenu = null;
    this.observer?.disconnect();
    this._structMO?.disconnect();
    this._structMO = null;
    this._moveQueue = null;
    this._moveScheduled = false;
    this._recheckQueue = null;
    this._recheckScheduled = false;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this._histLast = null;
  }
  /**
   * The editor was attached to the document.
   *
   * Forces one connector rescan per block. A block's DOM can legitimately change **while it is
   * detached** — a component that fills in its connectors during construction, or a host that
   * builds the whole graph first and attaches the editor afterwards. Those mutations were never
   * observed (the canvas `MutationObserver` watches `contentArea`, and a disconnected tree reports
   * nothing), so the memoised scan would keep the block's connector set empty forever and every
   * line referring to it would fail with "unknown connector" — for a graph loaded before mounting.
   *
   * One walk per block, once, on attach; the memoisation is untouched after that.
   */
  connectedCallback() {
    super.connectedCallback?.();
    if (this.destroyed || !this.blocks?.length)
      return;
    this.blocks.forEach((blockData) => {
      try {
        this.recheckConnectors(blockData, true);
      } catch (err) {
        console.error("NodeEditor: connector rescan on connect failed", err);
      }
    });
  }
  /**
   * The custom element was removed from the DOM — release everything it
   * holds (the canvas ResizeObserver is never disconnected otherwise).
   */
  disconnectedCallback() {
    super.disconnectedCallback?.();
    this.destroy();
  }
  /**
   *
   * @param {Element} el
   * @param {string} name
   * @param {*} [detail]
   */
  fireCustom(el, name, detail = {}) {
    fireCustom(el, name, detail);
    if (el != this)
      fireCustom(this, name, detail);
  }
  /**
   * Signal the end of a move/edit: fires `ne-move-done` (the demo persists on
   * it) and records the undo/redo snapshot. `kind` groups rapid consecutive
   * changes (see `historyRecord`), `'move'` never merges.
   * @param {BlockData} [blockData]
   * @param {string} [kind]
   */
  fireMoveDone(blockData, kind = "move") {
    this.fireMove(blockData, "ne-move-done");
    this.historyRecord(kind);
    let menu = this.currentMenu;
    if (menu) {
      setVisible(menu, true);
      if (this.selectedBlocks?.length)
        moveMenu(this.selectedBlocks, menu, this._zoom);
    }
  }
  fireMove(blockData, evtName = "ne-move") {
    if (!blockData)
      return;
    this.flushMoves();
    let { pos, id, el } = blockData;
    this.fireCustom(this, evtName, { top: pos[1], left: pos[0], nid: id, domNode: el, pos });
  }
};

// static/vanilla/demo.js
function makeBlock(type, title, ports) {
  const el = document.createElement("div");
  el.className = "vb";
  el.dataset.type = type;
  const head = document.createElement("div");
  head.className = "vb-title";
  head.setAttribute("ne-drag", "");
  head.textContent = title;
  el.appendChild(head);
  const body = document.createElement("div");
  body.className = "vb-body";
  for (const { ncid, dir, label } of ports) {
    const row = document.createElement("div");
    row.className = "vb-row";
    row.setAttribute("ne-item", "");
    row.textContent = label;
    const port = document.createElement("span");
    port.className = "vb-port";
    port.setAttribute("ncid", ncid);
    port.setAttribute("ne-connect", dir);
    row.appendChild(port);
    body.appendChild(row);
  }
  el.appendChild(body);
  return el;
}
var PORTS = {
  Switch: [
    { ncid: "i1", dir: "in", label: "in" },
    { ncid: "o1", dir: "out", label: "on" },
    { ncid: "o2", dir: "out", label: "off" }
  ],
  Message: [
    { ncid: "i1", dir: "in", label: "text" },
    { ncid: "o1", dir: "out", label: "out" }
  ],
  Value: [{ ncid: "o1", dir: "out", label: "value" }]
};
var typeMap = Object.fromEntries(
  Object.keys(PORTS).map((type) => [type, () => makeBlock(type, type, PORTS[type])])
);
var defaultGraph = {
  blocks: [
    { id: "1", type: "Value", pos: [20, 30] },
    { id: "2", type: "Switch", pos: [220, 20] },
    { id: "3", type: "Message", pos: [220, 230] },
    { id: "4", type: "Message", pos: [470, 230] }
  ],
  lines: [
    ["1/o1", "2/i1"],
    ["2/o1", "3/i1"],
    ["2/o2", "4/i1"]
  ]
};
function startVanillaDemo(host, { persist = true, onStatus } = {}) {
  const setStatus = (message) => onStatus?.(message);
  let nextId = 0;
  const newId = () => `n${++nextId}`;
  const menu = document.createElement("div");
  menu.className = "ne-menu";
  menu.style.cssText = "display:flex;gap:2px;padding:3px;border:solid 1px #bbb;background:#fff;border-radius:6px";
  const menuButton = (label, title, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ne-bt";
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", onClick);
    return b;
  };
  host.menuGenerator = () => menu;
  host.typeMap = typeMap;
  host.zoomMin = 0.3;
  host.zoomMax = 4;
  host.snap = 0;
  host.setAttribute("tabindex", "0");
  const save = () => {
    if (!persist)
      return;
    try {
      localStorage.setItem("ne.vanilla.graph", JSON.stringify(host.saveGraph()));
    } catch (err) {
      console.warn("vanilla demo: could not persist the graph", err);
    }
  };
  const restore = () => {
    let stored = null;
    if (persist) {
      try {
        stored = JSON.parse(localStorage.getItem("ne.vanilla.graph") || "null");
      } catch (err) {
        console.warn("vanilla demo: stored graph was not JSON, using the default", err);
      }
    }
    host.loadGraph(stored || defaultGraph);
    nextId = host.blocks.reduce((max, b) => Math.max(max, Number(String(b.id).replace(/\D/g, "")) || max), 0);
    setStatus(`${host.blocks.length} blocks`);
  };
  const addBlock = (type) => {
    const data = host.add(typeMap[type](), newId(), {
      type,
      pos: [40 + host.blocks.length % 4 * 30, 40 + host.blocks.length * 20]
    });
    host.selectBlocks([data]);
    setStatus(`added ${type} ${data.id}`);
    save();
  };
  const linkSelection = () => {
    const [a, b] = host.selectedBlocks || [];
    if (!a || !b) {
      setStatus("link needs two selected blocks");
      return;
    }
    const out = [...a.connectorMap.values()].find((c) => c.dir === "out");
    const inp = [...b.connectorMap.values()].find((c) => c.dir === "in");
    if (!out || !inp) {
      setStatus("no free out/in on the selected blocks");
      return;
    }
    host.addConnectorFromTo(out.idFull, inp.idFull);
    setStatus(`${out.idFull} -> ${inp.idFull}`);
    save();
  };
  const deleteSelection = () => {
    if ((host.selectedBlocks || []).length)
      host.selectConnector(null);
    host.deleteSelection();
    save();
  };
  menu.replaceChildren(
    menuButton("\u2715", "Delete selection", deleteSelection),
    menuButton("\u21B6", "Undo", () => host.undo()),
    menuButton("\u21B7", "Redo", () => host.redo()),
    menuButton("\u26F6", "Fit", () => host.resetView())
  );
  host.addEventListener("ne-move-done", save);
  host.addEventListener("ne-remove", () => {
    setStatus(`${host.blocks.length} blocks`);
    save();
  });
  host.addEventListener("ne-move", (e) => setStatus(`moved ${e.detail.connectors.length} connectors`));
  host.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      host.changeZoomMouse(e.deltaY > 0 ? -0.1 : 0.1, e);
    },
    { passive: false }
  );
  host.addEventListener("keydown", (e) => {
    if (e.key === "l" && !e.ctrlKey && !e.metaKey && !e.altKey)
      linkSelection();
  });
  document.addEventListener("click", (e) => {
    const act = e.target.closest?.("[data-act]")?.dataset.act;
    if (!act)
      return;
    if (act === "switch")
      addBlock("Switch");
    else if (act === "message")
      addBlock("Message");
    else if (act === "link")
      linkSelection();
    else if (act === "delete")
      deleteSelection();
    else if (act === "undo")
      host.undo();
    else if (act === "redo")
      host.redo();
    else if (act === "fit")
      host.resetView();
    else if (act === "snap")
      host.snap = e.target.checked ? 20 : 0;
  });
  restore();
  return host;
}

// smoke/boot.smoke.js
globalThis.getComputedStyle = () => ({
  getPropertyValue: () => "",
  zIndex: "auto",
  pointerEvents: "auto"
});
var failures = 0;
var ok = (cond, msg) => {
  if (cond)
    console.log("ok   " + msg);
  else {
    failures++;
    console.error("FAIL " + msg);
  }
};
var tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
var importOrReport = async (specifier) => {
  try {
    await import(specifier);
    return null;
  } catch (err) {
    return err && err.message ? err.message : String(err);
  }
};
var pageError = await importOrReport("./boot-page.bundle.mjs");
ok(
  pageError === null,
  `BOOT-1 the JSX demo page module body runs without throwing${pageError ? ` \u2014 ${pageError}` : ""}`
);
await tick(30);
var shell = document.createElement("jsx6-nodditor");
shell.className = "NodeEditor";
document.body.appendChild(shell);
var wiringError = null;
try {
  startVanillaDemo(shell, { persist: false });
} catch (err) {
  wiringError = err;
}
ok(
  wiringError === null,
  `BOOT-2 startVanillaDemo wires a host without throwing${wiringError ? ` \u2014 ${wiringError}` : ""}`
);
ok(shell instanceof NodeEditor, "BOOT-2 the shell is the editor custom element");
ok(shell.blocks.length > 0, `BOOT-2 the vanilla demo loaded its graph (${shell.blocks.length} blocks)`);
ok(
  shell.blocks.every((b) => b.connectorMap.size > 0),
  "BOOT-2 every block has its connectors discovered"
);
ok(shell.lines.length > 0, `BOOT-2 the vanilla demo restored its lines (${shell.lines.length})`);
shell.destroy();
console.log(failures ? `
${failures} FAILURE(S)` : "\nALL SMOKE ASSERTIONS PASSED");
process.exitCode = failures ? 1 : 0;
