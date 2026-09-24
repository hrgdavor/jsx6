// node_modules/alien-signals/esm/system.mjs
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

// node_modules/alien-signals/esm/index.mjs
var HasChildEffect = 64;
var cycle = 0;
var runDepth = 0;
var batchDepth = 0;
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
function setActiveSub(sub) {
  const prevSub = activeSub;
  activeSub = sub;
  return prevSub;
}
function startBatch() {
  ++batchDepth;
}
function endBatch() {
  if (!--batchDepth) {
    flush();
  }
}
function signal(initialValue) {
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
    if (!batchDepth) {
      flush();
    }
  }
}
function updateComputed(c2) {
  if (c2.flags & HasChildEffect) {
    let link2 = c2.depsTail;
    while (link2 !== void 0) {
      const prev = link2.prevDep;
      const dep = link2.dep;
      if (!("getter" in dep) && !("currentValue" in dep)) {
        unlink(link2, c2);
      }
      link2 = prev;
    }
  }
  c2.depsTail = void 0;
  c2.flags = 1 | 4;
  const prevSub = setActiveSub(c2);
  try {
    ++cycle;
    const oldValue = c2.value;
    return oldValue !== (c2.value = c2.getter(oldValue));
  } finally {
    activeSub = prevSub;
    c2.flags &= ~4;
    purgeDeps(c2);
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
        if (!batchDepth) {
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

// experiments/signal-directions/harness/.results/packages/alien-alone.entry.js
var a = signal(1);
var c = computed(() => a() * 2);
var stop = effect(() => {
  c();
  return void 0;
});
startBatch();
a(2);
endBatch();
trigger(() => a());
effectScope(() => {
});
stop();
globalThis.__alien = c();
