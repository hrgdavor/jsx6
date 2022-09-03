var qn = Object.defineProperty
var Sn = (e, t, n) =>
  t in e ? qn(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : (e[t] = n)
var ft = (e, t, n) => (Sn(e, typeof t != 'symbol' ? t + '' : t, n), n)
import { t as rn, J as Gt, h as vt, i as Zt, a as Tn, s as Rn } from './insertHtml.9eb1f3c8.js'
const ot = new WeakMap()
function Jt(e, t) {
  e = rn(e)
  let n = ot.get(e)
  return (
    n || ot.set(e, (n = [])),
    n.length || le.observe(e),
    n.push(t),
    function () {
      let r = ot.get(e)
      r && ot.set(e, (r = r.filter(o => o !== t))), (r != null && r.length) || le.unobserve(e)
    }
  )
}
const le = (Jt.observer = new ResizeObserver(e => {
  e.forEach(t => {
    var n
    ;(n = ot.get(t.target)) == null ||
      n.forEach(r => {
        try {
          r(t)
        } catch (o) {
          console.error('problem calling ResizeObserver listener: ' + o.message, r, o)
        }
      })
  })
}))
function Ln(e, t, n) {
  e = rn(e)
  const r = e.classList
  n ? r.add(t) : r.remove(t)
}
const Fn = {
  JSX6E1: 'Tag is null',
  JSX6E2: 'Tag type is not supported',
  JSX6E3: 'Translation updater must be a function',
  JSX6E4: 'updater undefined',
  JSX6E5: 'dirty runner must be a function',
  JSX6E6: `If you are seeing this, you are using a binding function wrong
 - used $state instead state in template 
 - called binding.toString()
property that was used wrongly:`,
  JSX6E7: 'Function required',
  JSX6E8: 'Parent required',
  JSX6E9: 'Event listener must be a function ',
}
const ae = () => {
  throw new Error('Monaco module is missing. Please load monaco module and call setMonacoModule')
}
let Kt = { colorize: ae, editor: { create: ae } }
class ue extends Gt {
  setValue(t) {
    this.editor.getModel().setValue(t)
  }
  getValue() {
    return this.editor.getModel().getValue()
  }
  init() {
    this.editor = Kt.editor.create(this.el, {
      value: '',
      language: 'javascript',
      automaticLayout: !0,
      minimap: { enabled: !1 },
    })
  }
}
const Mn = (...e) => Kt.editor.colorize(...e),
  In = e => (Kt = e),
  fe = '({',
  zn = '})'
function Pn(e, t = 'md') {
  const n = e
      .split(
        `
`,
      )
      .map(f => f.trimEnd()),
    r = { sections: [] }
  let o = { title: '', lines: [], level: 0 },
    s,
    i,
    c,
    l,
    a = ''
  const u = o
  return (
    n.forEach((f, h) => {
      const p = h + 1,
        d = f.trim()
      if (f[0] === '#') {
        for (l = 1; f[l] === '#'; ) l++
        ;(i = f), (c = null), (o = { title: i, lines: [], level: l }), r.sections.push(o)
      } else if (a || d.startsWith(fe)) {
        if (((a += d), a.endsWith(zn)))
          try {
            const m = s || o || r
            m.info = JSON.parse(a.substring(1, a.length - 1))
          } catch (m) {
            throw new Error(`Error parsing section info at ${t}:${p}. ${m.message}. ${a}`)
          } finally {
            a = ''
          }
      } else if (o)
        if (f.substring(0, 3) === '```')
          if (s) f.substring(0, 3) === '```' ? (s = null) : s.lines.push(f)
          else {
            i = f.substring(3).trim()
            const m = i.indexOf(fe)
            m !== -1 && ((c = i.substring(m + 1, i.length - 1)), (i = i.substring(0, m).trim())),
              (s = { code: i, lines: [] })
            try {
              c && (s.info = JSON.parse(c))
            } catch (_) {
              throw new Error(`Error parsing code-block info at ${t}:${p}. ${_.message}. ${f}`)
            }
            o.lines.push(s)
          }
        else (s || o).lines.push(f)
      else throw new Error('unhandled parser state')
    }),
    u.info && ((r.info = u.info), delete u.info),
    u.lines.length && r.sections.unshift(u),
    r
  )
}
function on(e, t = 'md', n, r) {
  return J(e, [], n, r).join(`
`)
}
function Bn(e) {
  return `(${JSON.stringify(e)})`
}
function J(e, t = [], n, r) {
  var s
  const o = () => {
    !n && e.info && t.push(Bn(e.info))
  }
  if (e instanceof Array)
    e.forEach(i => {
      typeof i == 'string' ? t.push(i) : J(i, t, n, r)
    })
  else if (!(r && ((s = e.info) == null ? void 0 : s.hidden)))
    if (e.sections) o(), e.sections.forEach(i => J(i, t, n, r))
    else if (e.title !== void 0) {
      let i = e.title
      e.level && t.push(i), o(), J(e.lines, t, n, r)
    } else {
      let i = '```'
      e.code && (i += e.code), t.push(i), o(), J(e.lines, t, n, r), t.push('```')
    }
  return t
}
on.toLines = J
/*!
 * perfect-scrollbar v1.5.3
 * Copyright 2021 Hyunje Jun, MDBootstrap and Contributors
 * Licensed under MIT
 */ function B(e) {
  return getComputedStyle(e)
}
function F(e, t) {
  for (var n in t) {
    var r = t[n]
    typeof r == 'number' && (r = r + 'px'), (e.style[n] = r)
  }
  return e
}
function pt(e) {
  var t = document.createElement('div')
  return (t.className = e), t
}
var pe =
  typeof Element < 'u' &&
  (Element.prototype.matches ||
    Element.prototype.webkitMatchesSelector ||
    Element.prototype.mozMatchesSelector ||
    Element.prototype.msMatchesSelector)
function j(e, t) {
  if (!pe) throw new Error('No element matching method supported')
  return pe.call(e, t)
}
function K(e) {
  e.remove ? e.remove() : e.parentNode && e.parentNode.removeChild(e)
}
function he(e, t) {
  return Array.prototype.filter.call(e.children, function (n) {
    return j(n, t)
  })
}
var R = {
    main: 'ps',
    rtl: 'ps__rtl',
    element: {
      thumb: function (e) {
        return 'ps__thumb-' + e
      },
      rail: function (e) {
        return 'ps__rail-' + e
      },
      consuming: 'ps__child--consume',
    },
    state: {
      focus: 'ps--focus',
      clicking: 'ps--clicking',
      active: function (e) {
        return 'ps--active-' + e
      },
      scrolling: function (e) {
        return 'ps--scrolling-' + e
      },
    },
  },
  sn = { x: null, y: null }
function cn(e, t) {
  var n = e.element.classList,
    r = R.state.scrolling(t)
  n.contains(r) ? clearTimeout(sn[t]) : n.add(r)
}
function ln(e, t) {
  sn[t] = setTimeout(function () {
    return e.isAlive && e.element.classList.remove(R.state.scrolling(t))
  }, e.settings.scrollingThreshold)
}
function Nn(e, t) {
  cn(e, t), ln(e, t)
}
var ct = function (t) {
    ;(this.element = t), (this.handlers = {})
  },
  an = { isEmpty: { configurable: !0 } }
ct.prototype.bind = function (t, n) {
  typeof this.handlers[t] > 'u' && (this.handlers[t] = []),
    this.handlers[t].push(n),
    this.element.addEventListener(t, n, !1)
}
ct.prototype.unbind = function (t, n) {
  var r = this
  this.handlers[t] = this.handlers[t].filter(function (o) {
    return n && o !== n ? !0 : (r.element.removeEventListener(t, o, !1), !1)
  })
}
ct.prototype.unbindAll = function () {
  for (var t in this.handlers) this.unbind(t)
}
an.isEmpty.get = function () {
  var e = this
  return Object.keys(this.handlers).every(function (t) {
    return e.handlers[t].length === 0
  })
}
Object.defineProperties(ct.prototype, an)
var Q = function () {
  this.eventElements = []
}
Q.prototype.eventElement = function (t) {
  var n = this.eventElements.filter(function (r) {
    return r.element === t
  })[0]
  return n || ((n = new ct(t)), this.eventElements.push(n)), n
}
Q.prototype.bind = function (t, n, r) {
  this.eventElement(t).bind(n, r)
}
Q.prototype.unbind = function (t, n, r) {
  var o = this.eventElement(t)
  o.unbind(n, r), o.isEmpty && this.eventElements.splice(this.eventElements.indexOf(o), 1)
}
Q.prototype.unbindAll = function () {
  this.eventElements.forEach(function (t) {
    return t.unbindAll()
  }),
    (this.eventElements = [])
}
Q.prototype.once = function (t, n, r) {
  var o = this.eventElement(t),
    s = function (i) {
      o.unbind(n, s), r(i)
    }
  o.bind(n, s)
}
function ht(e) {
  if (typeof window.CustomEvent == 'function') return new CustomEvent(e)
  var t = document.createEvent('CustomEvent')
  return t.initCustomEvent(e, !1, !1, void 0), t
}
function _t(e, t, n, r, o) {
  r === void 0 && (r = !0), o === void 0 && (o = !1)
  var s
  if (t === 'top') s = ['contentHeight', 'containerHeight', 'scrollTop', 'y', 'up', 'down']
  else if (t === 'left') s = ['contentWidth', 'containerWidth', 'scrollLeft', 'x', 'left', 'right']
  else throw new Error('A proper axis should be provided')
  On(e, n, s, r, o)
}
function On(e, t, n, r, o) {
  var s = n[0],
    i = n[1],
    c = n[2],
    l = n[3],
    a = n[4],
    u = n[5]
  r === void 0 && (r = !0), o === void 0 && (o = !1)
  var f = e.element
  ;(e.reach[l] = null),
    f[c] < 1 && (e.reach[l] = 'start'),
    f[c] > e[s] - e[i] - 1 && (e.reach[l] = 'end'),
    t &&
      (f.dispatchEvent(ht('ps-scroll-' + l)),
      t < 0 ? f.dispatchEvent(ht('ps-scroll-' + a)) : t > 0 && f.dispatchEvent(ht('ps-scroll-' + u)),
      r && Nn(e, l)),
    e.reach[l] && (t || o) && f.dispatchEvent(ht('ps-' + l + '-reach-' + e.reach[l]))
}
function q(e) {
  return parseInt(e, 10) || 0
}
function Hn(e) {
  return (
    j(e, 'input,[contenteditable]') ||
    j(e, 'select,[contenteditable]') ||
    j(e, 'textarea,[contenteditable]') ||
    j(e, 'button,[contenteditable]')
  )
}
function Un(e) {
  var t = B(e)
  return q(t.width) + q(t.paddingLeft) + q(t.paddingRight) + q(t.borderLeftWidth) + q(t.borderRightWidth)
}
var Z = {
  isWebKit: typeof document < 'u' && 'WebkitAppearance' in document.documentElement.style,
  supportsTouch:
    typeof window < 'u' &&
    ('ontouchstart' in window ||
      ('maxTouchPoints' in window.navigator && window.navigator.maxTouchPoints > 0) ||
      (window.DocumentTouch && document instanceof window.DocumentTouch)),
  supportsIePointer: typeof navigator < 'u' && navigator.msMaxTouchPoints,
  isChrome: typeof navigator < 'u' && /Chrome/i.test(navigator && navigator.userAgent),
}
function H(e) {
  var t = e.element,
    n = Math.floor(t.scrollTop),
    r = t.getBoundingClientRect()
  ;(e.containerWidth = Math.round(r.width)),
    (e.containerHeight = Math.round(r.height)),
    (e.contentWidth = t.scrollWidth),
    (e.contentHeight = t.scrollHeight),
    t.contains(e.scrollbarXRail) ||
      (he(t, R.element.rail('x')).forEach(function (o) {
        return K(o)
      }),
      t.appendChild(e.scrollbarXRail)),
    t.contains(e.scrollbarYRail) ||
      (he(t, R.element.rail('y')).forEach(function (o) {
        return K(o)
      }),
      t.appendChild(e.scrollbarYRail)),
    !e.settings.suppressScrollX && e.containerWidth + e.settings.scrollXMarginOffset < e.contentWidth
      ? ((e.scrollbarXActive = !0),
        (e.railXWidth = e.containerWidth - e.railXMarginWidth),
        (e.railXRatio = e.containerWidth / e.railXWidth),
        (e.scrollbarXWidth = de(e, q((e.railXWidth * e.containerWidth) / e.contentWidth))),
        (e.scrollbarXLeft = q(
          ((e.negativeScrollAdjustment + t.scrollLeft) * (e.railXWidth - e.scrollbarXWidth)) /
            (e.contentWidth - e.containerWidth),
        )))
      : (e.scrollbarXActive = !1),
    !e.settings.suppressScrollY && e.containerHeight + e.settings.scrollYMarginOffset < e.contentHeight
      ? ((e.scrollbarYActive = !0),
        (e.railYHeight = e.containerHeight - e.railYMarginHeight),
        (e.railYRatio = e.containerHeight / e.railYHeight),
        (e.scrollbarYHeight = de(e, q((e.railYHeight * e.containerHeight) / e.contentHeight))),
        (e.scrollbarYTop = q(
          (n * (e.railYHeight - e.scrollbarYHeight)) / (e.contentHeight - e.containerHeight),
        )))
      : (e.scrollbarYActive = !1),
    e.scrollbarXLeft >= e.railXWidth - e.scrollbarXWidth &&
      (e.scrollbarXLeft = e.railXWidth - e.scrollbarXWidth),
    e.scrollbarYTop >= e.railYHeight - e.scrollbarYHeight &&
      (e.scrollbarYTop = e.railYHeight - e.scrollbarYHeight),
    jn(t, e),
    e.scrollbarXActive
      ? t.classList.add(R.state.active('x'))
      : (t.classList.remove(R.state.active('x')),
        (e.scrollbarXWidth = 0),
        (e.scrollbarXLeft = 0),
        (t.scrollLeft = e.isRtl === !0 ? e.contentWidth : 0)),
    e.scrollbarYActive
      ? t.classList.add(R.state.active('y'))
      : (t.classList.remove(R.state.active('y')),
        (e.scrollbarYHeight = 0),
        (e.scrollbarYTop = 0),
        (t.scrollTop = 0))
}
function de(e, t) {
  return (
    e.settings.minScrollbarLength && (t = Math.max(t, e.settings.minScrollbarLength)),
    e.settings.maxScrollbarLength && (t = Math.min(t, e.settings.maxScrollbarLength)),
    t
  )
}
function jn(e, t) {
  var n = { width: t.railXWidth },
    r = Math.floor(e.scrollTop)
  t.isRtl
    ? (n.left = t.negativeScrollAdjustment + e.scrollLeft + t.containerWidth - t.contentWidth)
    : (n.left = e.scrollLeft),
    t.isScrollbarXUsingBottom ? (n.bottom = t.scrollbarXBottom - r) : (n.top = t.scrollbarXTop + r),
    F(t.scrollbarXRail, n)
  var o = { top: r, height: t.railYHeight }
  t.isScrollbarYUsingRight
    ? t.isRtl
      ? (o.right =
          t.contentWidth -
          (t.negativeScrollAdjustment + e.scrollLeft) -
          t.scrollbarYRight -
          t.scrollbarYOuterWidth -
          9)
      : (o.right = t.scrollbarYRight - e.scrollLeft)
    : t.isRtl
    ? (o.left =
        t.negativeScrollAdjustment +
        e.scrollLeft +
        t.containerWidth * 2 -
        t.contentWidth -
        t.scrollbarYLeft -
        t.scrollbarYOuterWidth)
    : (o.left = t.scrollbarYLeft + e.scrollLeft),
    F(t.scrollbarYRail, o),
    F(t.scrollbarX, { left: t.scrollbarXLeft, width: t.scrollbarXWidth - t.railBorderXWidth }),
    F(t.scrollbarY, { top: t.scrollbarYTop, height: t.scrollbarYHeight - t.railBorderYWidth })
}
function Vn(e) {
  e.element,
    e.event.bind(e.scrollbarY, 'mousedown', function (t) {
      return t.stopPropagation()
    }),
    e.event.bind(e.scrollbarYRail, 'mousedown', function (t) {
      var n = t.pageY - window.pageYOffset - e.scrollbarYRail.getBoundingClientRect().top,
        r = n > e.scrollbarYTop ? 1 : -1
      ;(e.element.scrollTop += r * e.containerHeight), H(e), t.stopPropagation()
    }),
    e.event.bind(e.scrollbarX, 'mousedown', function (t) {
      return t.stopPropagation()
    }),
    e.event.bind(e.scrollbarXRail, 'mousedown', function (t) {
      var n = t.pageX - window.pageXOffset - e.scrollbarXRail.getBoundingClientRect().left,
        r = n > e.scrollbarXLeft ? 1 : -1
      ;(e.element.scrollLeft += r * e.containerWidth), H(e), t.stopPropagation()
    })
}
function $n(e) {
  ge(e, [
    'containerWidth',
    'contentWidth',
    'pageX',
    'railXWidth',
    'scrollbarX',
    'scrollbarXWidth',
    'scrollLeft',
    'x',
    'scrollbarXRail',
  ]),
    ge(e, [
      'containerHeight',
      'contentHeight',
      'pageY',
      'railYHeight',
      'scrollbarY',
      'scrollbarYHeight',
      'scrollTop',
      'y',
      'scrollbarYRail',
    ])
}
function ge(e, t) {
  var n = t[0],
    r = t[1],
    o = t[2],
    s = t[3],
    i = t[4],
    c = t[5],
    l = t[6],
    a = t[7],
    u = t[8],
    f = e.element,
    h = null,
    p = null,
    d = null
  function m(g) {
    g.touches && g.touches[0] && (g[o] = g.touches[0].pageY),
      (f[l] = h + d * (g[o] - p)),
      cn(e, a),
      H(e),
      g.stopPropagation(),
      g.type.startsWith('touch') && g.changedTouches.length > 1 && g.preventDefault()
  }
  function _() {
    ln(e, a), e[u].classList.remove(R.state.clicking), e.event.unbind(e.ownerDocument, 'mousemove', m)
  }
  function b(g, x) {
    ;(h = f[l]),
      x && g.touches && (g[o] = g.touches[0].pageY),
      (p = g[o]),
      (d = (e[r] - e[n]) / (e[s] - e[c])),
      x
        ? e.event.bind(e.ownerDocument, 'touchmove', m)
        : (e.event.bind(e.ownerDocument, 'mousemove', m),
          e.event.once(e.ownerDocument, 'mouseup', _),
          g.preventDefault()),
      e[u].classList.add(R.state.clicking),
      g.stopPropagation()
  }
  e.event.bind(e[i], 'mousedown', function (g) {
    b(g)
  }),
    e.event.bind(e[i], 'touchstart', function (g) {
      b(g, !0)
    })
}
function Xn(e) {
  var t = e.element,
    n = function () {
      return j(t, ':hover')
    },
    r = function () {
      return j(e.scrollbarX, ':focus') || j(e.scrollbarY, ':focus')
    }
  function o(s, i) {
    var c = Math.floor(t.scrollTop)
    if (s === 0) {
      if (!e.scrollbarYActive) return !1
      if ((c === 0 && i > 0) || (c >= e.contentHeight - e.containerHeight && i < 0))
        return !e.settings.wheelPropagation
    }
    var l = t.scrollLeft
    if (i === 0) {
      if (!e.scrollbarXActive) return !1
      if ((l === 0 && s < 0) || (l >= e.contentWidth - e.containerWidth && s > 0))
        return !e.settings.wheelPropagation
    }
    return !0
  }
  e.event.bind(e.ownerDocument, 'keydown', function (s) {
    if (!((s.isDefaultPrevented && s.isDefaultPrevented()) || s.defaultPrevented) && !(!n() && !r())) {
      var i = document.activeElement ? document.activeElement : e.ownerDocument.activeElement
      if (i) {
        if (i.tagName === 'IFRAME') i = i.contentDocument.activeElement
        else for (; i.shadowRoot; ) i = i.shadowRoot.activeElement
        if (Hn(i)) return
      }
      var c = 0,
        l = 0
      switch (s.which) {
        case 37:
          s.metaKey ? (c = -e.contentWidth) : s.altKey ? (c = -e.containerWidth) : (c = -30)
          break
        case 38:
          s.metaKey ? (l = e.contentHeight) : s.altKey ? (l = e.containerHeight) : (l = 30)
          break
        case 39:
          s.metaKey ? (c = e.contentWidth) : s.altKey ? (c = e.containerWidth) : (c = 30)
          break
        case 40:
          s.metaKey ? (l = -e.contentHeight) : s.altKey ? (l = -e.containerHeight) : (l = -30)
          break
        case 32:
          s.shiftKey ? (l = e.containerHeight) : (l = -e.containerHeight)
          break
        case 33:
          l = e.containerHeight
          break
        case 34:
          l = -e.containerHeight
          break
        case 36:
          l = e.contentHeight
          break
        case 35:
          l = -e.contentHeight
          break
        default:
          return
      }
      ;(e.settings.suppressScrollX && c !== 0) ||
        (e.settings.suppressScrollY && l !== 0) ||
        ((t.scrollTop -= l), (t.scrollLeft += c), H(e), o(c, l) && s.preventDefault())
    }
  })
}
function Yn(e) {
  var t = e.element
  function n(i, c) {
    var l = Math.floor(t.scrollTop),
      a = t.scrollTop === 0,
      u = l + t.offsetHeight === t.scrollHeight,
      f = t.scrollLeft === 0,
      h = t.scrollLeft + t.offsetWidth === t.scrollWidth,
      p
    return Math.abs(c) > Math.abs(i) ? (p = a || u) : (p = f || h), p ? !e.settings.wheelPropagation : !0
  }
  function r(i) {
    var c = i.deltaX,
      l = -1 * i.deltaY
    return (
      (typeof c > 'u' || typeof l > 'u') && ((c = (-1 * i.wheelDeltaX) / 6), (l = i.wheelDeltaY / 6)),
      i.deltaMode && i.deltaMode === 1 && ((c *= 10), (l *= 10)),
      c !== c && l !== l && ((c = 0), (l = i.wheelDelta)),
      i.shiftKey ? [-l, -c] : [c, l]
    )
  }
  function o(i, c, l) {
    if (!Z.isWebKit && t.querySelector('select:focus')) return !0
    if (!t.contains(i)) return !1
    for (var a = i; a && a !== t; ) {
      if (a.classList.contains(R.element.consuming)) return !0
      var u = B(a)
      if (l && u.overflowY.match(/(scroll|auto)/)) {
        var f = a.scrollHeight - a.clientHeight
        if (f > 0 && ((a.scrollTop > 0 && l < 0) || (a.scrollTop < f && l > 0))) return !0
      }
      if (c && u.overflowX.match(/(scroll|auto)/)) {
        var h = a.scrollWidth - a.clientWidth
        if (h > 0 && ((a.scrollLeft > 0 && c < 0) || (a.scrollLeft < h && c > 0))) return !0
      }
      a = a.parentNode
    }
    return !1
  }
  function s(i) {
    var c = r(i),
      l = c[0],
      a = c[1]
    if (!o(i.target, l, a)) {
      var u = !1
      e.settings.useBothWheelAxes
        ? e.scrollbarYActive && !e.scrollbarXActive
          ? (a ? (t.scrollTop -= a * e.settings.wheelSpeed) : (t.scrollTop += l * e.settings.wheelSpeed),
            (u = !0))
          : e.scrollbarXActive &&
            !e.scrollbarYActive &&
            (l ? (t.scrollLeft += l * e.settings.wheelSpeed) : (t.scrollLeft -= a * e.settings.wheelSpeed),
            (u = !0))
        : ((t.scrollTop -= a * e.settings.wheelSpeed), (t.scrollLeft += l * e.settings.wheelSpeed)),
        H(e),
        (u = u || n(l, a)),
        u && !i.ctrlKey && (i.stopPropagation(), i.preventDefault())
    }
  }
  typeof window.onwheel < 'u'
    ? e.event.bind(t, 'wheel', s)
    : typeof window.onmousewheel < 'u' && e.event.bind(t, 'mousewheel', s)
}
function Wn(e) {
  if (!Z.supportsTouch && !Z.supportsIePointer) return
  var t = e.element
  function n(d, m) {
    var _ = Math.floor(t.scrollTop),
      b = t.scrollLeft,
      g = Math.abs(d),
      x = Math.abs(m)
    if (x > g) {
      if ((m < 0 && _ === e.contentHeight - e.containerHeight) || (m > 0 && _ === 0))
        return window.scrollY === 0 && m > 0 && Z.isChrome
    } else if (g > x && ((d < 0 && b === e.contentWidth - e.containerWidth) || (d > 0 && b === 0))) return !0
    return !0
  }
  function r(d, m) {
    ;(t.scrollTop -= m), (t.scrollLeft -= d), H(e)
  }
  var o = {},
    s = 0,
    i = {},
    c = null
  function l(d) {
    return d.targetTouches ? d.targetTouches[0] : d
  }
  function a(d) {
    return d.pointerType && d.pointerType === 'pen' && d.buttons === 0
      ? !1
      : !!(
          (d.targetTouches && d.targetTouches.length === 1) ||
          (d.pointerType && d.pointerType !== 'mouse' && d.pointerType !== d.MSPOINTER_TYPE_MOUSE)
        )
  }
  function u(d) {
    if (!!a(d)) {
      var m = l(d)
      ;(o.pageX = m.pageX), (o.pageY = m.pageY), (s = new Date().getTime()), c !== null && clearInterval(c)
    }
  }
  function f(d, m, _) {
    if (!t.contains(d)) return !1
    for (var b = d; b && b !== t; ) {
      if (b.classList.contains(R.element.consuming)) return !0
      var g = B(b)
      if (_ && g.overflowY.match(/(scroll|auto)/)) {
        var x = b.scrollHeight - b.clientHeight
        if (x > 0 && ((b.scrollTop > 0 && _ < 0) || (b.scrollTop < x && _ > 0))) return !0
      }
      if (m && g.overflowX.match(/(scroll|auto)/)) {
        var y = b.scrollWidth - b.clientWidth
        if (y > 0 && ((b.scrollLeft > 0 && m < 0) || (b.scrollLeft < y && m > 0))) return !0
      }
      b = b.parentNode
    }
    return !1
  }
  function h(d) {
    if (a(d)) {
      var m = l(d),
        _ = { pageX: m.pageX, pageY: m.pageY },
        b = _.pageX - o.pageX,
        g = _.pageY - o.pageY
      if (f(d.target, b, g)) return
      r(b, g), (o = _)
      var x = new Date().getTime(),
        y = x - s
      y > 0 && ((i.x = b / y), (i.y = g / y), (s = x)), n(b, g) && d.preventDefault()
    }
  }
  function p() {
    e.settings.swipeEasing &&
      (clearInterval(c),
      (c = setInterval(function () {
        if (e.isInitialized) {
          clearInterval(c)
          return
        }
        if (!i.x && !i.y) {
          clearInterval(c)
          return
        }
        if (Math.abs(i.x) < 0.01 && Math.abs(i.y) < 0.01) {
          clearInterval(c)
          return
        }
        if (!e.element) {
          clearInterval(c)
          return
        }
        r(i.x * 30, i.y * 30), (i.x *= 0.8), (i.y *= 0.8)
      }, 10)))
  }
  Z.supportsTouch
    ? (e.event.bind(t, 'touchstart', u), e.event.bind(t, 'touchmove', h), e.event.bind(t, 'touchend', p))
    : Z.supportsIePointer &&
      (window.PointerEvent
        ? (e.event.bind(t, 'pointerdown', u),
          e.event.bind(t, 'pointermove', h),
          e.event.bind(t, 'pointerup', p))
        : window.MSPointerEvent &&
          (e.event.bind(t, 'MSPointerDown', u),
          e.event.bind(t, 'MSPointerMove', h),
          e.event.bind(t, 'MSPointerUp', p)))
}
var Gn = function () {
    return {
      handlers: ['click-rail', 'drag-thumb', 'keyboard', 'wheel', 'touch'],
      maxScrollbarLength: null,
      minScrollbarLength: null,
      scrollingThreshold: 1e3,
      scrollXMarginOffset: 0,
      scrollYMarginOffset: 0,
      suppressScrollX: !1,
      suppressScrollY: !1,
      swipeEasing: !0,
      useBothWheelAxes: !1,
      wheelPropagation: !0,
      wheelSpeed: 1,
    }
  },
  Zn = { 'click-rail': Vn, 'drag-thumb': $n, keyboard: Xn, wheel: Yn, touch: Wn },
  it = function (t, n) {
    var r = this
    if (
      (n === void 0 && (n = {}), typeof t == 'string' && (t = document.querySelector(t)), !t || !t.nodeName)
    )
      throw new Error('no element is specified to initialize PerfectScrollbar')
    ;(this.element = t), t.classList.add(R.main), (this.settings = Gn())
    for (var o in n) this.settings[o] = n[o]
    ;(this.containerWidth = null),
      (this.containerHeight = null),
      (this.contentWidth = null),
      (this.contentHeight = null)
    var s = function () {
        return t.classList.add(R.state.focus)
      },
      i = function () {
        return t.classList.remove(R.state.focus)
      }
    ;(this.isRtl = B(t).direction === 'rtl'),
      this.isRtl === !0 && t.classList.add(R.rtl),
      (this.isNegativeScroll = (function () {
        var a = t.scrollLeft,
          u = null
        return (t.scrollLeft = -1), (u = t.scrollLeft < 0), (t.scrollLeft = a), u
      })()),
      (this.negativeScrollAdjustment = this.isNegativeScroll ? t.scrollWidth - t.clientWidth : 0),
      (this.event = new Q()),
      (this.ownerDocument = t.ownerDocument || document),
      (this.scrollbarXRail = pt(R.element.rail('x'))),
      t.appendChild(this.scrollbarXRail),
      (this.scrollbarX = pt(R.element.thumb('x'))),
      this.scrollbarXRail.appendChild(this.scrollbarX),
      this.scrollbarX.setAttribute('tabindex', 0),
      this.event.bind(this.scrollbarX, 'focus', s),
      this.event.bind(this.scrollbarX, 'blur', i),
      (this.scrollbarXActive = null),
      (this.scrollbarXWidth = null),
      (this.scrollbarXLeft = null)
    var c = B(this.scrollbarXRail)
    ;(this.scrollbarXBottom = parseInt(c.bottom, 10)),
      isNaN(this.scrollbarXBottom)
        ? ((this.isScrollbarXUsingBottom = !1), (this.scrollbarXTop = q(c.top)))
        : (this.isScrollbarXUsingBottom = !0),
      (this.railBorderXWidth = q(c.borderLeftWidth) + q(c.borderRightWidth)),
      F(this.scrollbarXRail, { display: 'block' }),
      (this.railXMarginWidth = q(c.marginLeft) + q(c.marginRight)),
      F(this.scrollbarXRail, { display: '' }),
      (this.railXWidth = null),
      (this.railXRatio = null),
      (this.scrollbarYRail = pt(R.element.rail('y'))),
      t.appendChild(this.scrollbarYRail),
      (this.scrollbarY = pt(R.element.thumb('y'))),
      this.scrollbarYRail.appendChild(this.scrollbarY),
      this.scrollbarY.setAttribute('tabindex', 0),
      this.event.bind(this.scrollbarY, 'focus', s),
      this.event.bind(this.scrollbarY, 'blur', i),
      (this.scrollbarYActive = null),
      (this.scrollbarYHeight = null),
      (this.scrollbarYTop = null)
    var l = B(this.scrollbarYRail)
    ;(this.scrollbarYRight = parseInt(l.right, 10)),
      isNaN(this.scrollbarYRight)
        ? ((this.isScrollbarYUsingRight = !1), (this.scrollbarYLeft = q(l.left)))
        : (this.isScrollbarYUsingRight = !0),
      (this.scrollbarYOuterWidth = this.isRtl ? Un(this.scrollbarY) : null),
      (this.railBorderYWidth = q(l.borderTopWidth) + q(l.borderBottomWidth)),
      F(this.scrollbarYRail, { display: 'block' }),
      (this.railYMarginHeight = q(l.marginTop) + q(l.marginBottom)),
      F(this.scrollbarYRail, { display: '' }),
      (this.railYHeight = null),
      (this.railYRatio = null),
      (this.reach = {
        x:
          t.scrollLeft <= 0
            ? 'start'
            : t.scrollLeft >= this.contentWidth - this.containerWidth
            ? 'end'
            : null,
        y:
          t.scrollTop <= 0
            ? 'start'
            : t.scrollTop >= this.contentHeight - this.containerHeight
            ? 'end'
            : null,
      }),
      (this.isAlive = !0),
      this.settings.handlers.forEach(function (a) {
        return Zn[a](r)
      }),
      (this.lastScrollTop = Math.floor(t.scrollTop)),
      (this.lastScrollLeft = t.scrollLeft),
      this.event.bind(this.element, 'scroll', function (a) {
        return r.onScroll(a)
      }),
      H(this)
  }
it.prototype.update = function () {
  !this.isAlive ||
    ((this.negativeScrollAdjustment = this.isNegativeScroll
      ? this.element.scrollWidth - this.element.clientWidth
      : 0),
    F(this.scrollbarXRail, { display: 'block' }),
    F(this.scrollbarYRail, { display: 'block' }),
    (this.railXMarginWidth = q(B(this.scrollbarXRail).marginLeft) + q(B(this.scrollbarXRail).marginRight)),
    (this.railYMarginHeight = q(B(this.scrollbarYRail).marginTop) + q(B(this.scrollbarYRail).marginBottom)),
    F(this.scrollbarXRail, { display: 'none' }),
    F(this.scrollbarYRail, { display: 'none' }),
    H(this),
    _t(this, 'top', 0, !1, !0),
    _t(this, 'left', 0, !1, !0),
    F(this.scrollbarXRail, { display: '' }),
    F(this.scrollbarYRail, { display: '' }))
}
it.prototype.onScroll = function (t) {
  !this.isAlive ||
    (H(this),
    _t(this, 'top', this.element.scrollTop - this.lastScrollTop),
    _t(this, 'left', this.element.scrollLeft - this.lastScrollLeft),
    (this.lastScrollTop = Math.floor(this.element.scrollTop)),
    (this.lastScrollLeft = this.element.scrollLeft))
}
it.prototype.destroy = function () {
  !this.isAlive ||
    (this.event.unbindAll(),
    K(this.scrollbarX),
    K(this.scrollbarY),
    K(this.scrollbarXRail),
    K(this.scrollbarYRail),
    this.removePsClasses(),
    (this.element = null),
    (this.scrollbarX = null),
    (this.scrollbarY = null),
    (this.scrollbarXRail = null),
    (this.scrollbarYRail = null),
    (this.isAlive = !1))
}
it.prototype.removePsClasses = function () {
  this.element.className = this.element.className
    .split(' ')
    .filter(function (t) {
      return !t.match(/^ps([-_].+|)$/)
    })
    .join(' ')
}
class Jn {
  constructor() {
    this.promise = new Promise((t, n) => {
      ;(this.resolve = t), (this.reject = n)
    })
  }
}
const me = 'onPrepareIframe',
  be = new WeakMap()
function un(e, t, n = !1) {
  let r = be.get(e)
  if (!r)
    if (n) be.set(e, (r = new Map()))
    else return
  let o = r.get(t)
  if (!o)
    if (n) r.set(t, (o = []))
    else return
  return o
}
function Kn(e, t, n) {
  un(e, t, !0).push(n)
}
function Qn(e, t, n) {
  var r
  ;(r = un(e, t)) == null ||
    r.forEach(o => {
      try {
        o(...n)
      } catch (s) {
        console.error(s.message, s, 'listener', o)
      }
    })
}
class tr extends Gt {
  constructor(...t) {
    super(...t)
    const [n] = t,
      r = {
        sandbox: (n == null ? void 0 : n.sandbox) || 'allow-same-origin allow-scripts',
        src: (n == null ? void 0 : n.src) || 'about:blank',
        style: 'position:absolute; opacity:0; border:none',
      }
    ;(this.iframes = [vt('iframe', r), vt('iframe', r)]), (this.frameIndex = 0)
  }
  reloadFrame(t) {
    t(this.next())
  }
  onPrepareIframe(t) {
    Kn(this, me, t), this.iframes.forEach(t)
  }
  waitNext(t = !0) {
    var r
    ;(r = this.promise) == null || r.reject('skipped')
    const n = this.next(t)
    return n.__loading ? ((this.promise = new Jn()), this.promise.promise) : Promise.resolve(n)
  }
  next(t = !0) {
    const n = this.iframes[this.frameIndex]
    this.frameIndex = (this.frameIndex + 1) % this.iframes.length
    const r = this.iframes[this.frameIndex]
    return (this.toShow = r), (n.__loading = !0), (this.toClean = n), t && this.applyVisibility(), r
  }
  applyVisibility() {
    this.iframes.forEach(n => (n.style.opacity = n == this.toShow ? '1' : '0')),
      this.iframes.forEach(n => (n.style.zIndex = n == this.toShow ? '1' : '0')),
      this.toClean.contentWindow.document.location.reload()
  }
  onload(t) {
    var r
    const n = t.target
    ;(t.target.loadCounter = (t.target.loadCounter || 0) + 1),
      (t.target.__loading = !1),
      Qn(this, me, [n]),
      (r = this.promise) == null || r.resolve(n),
      (this.promise = null)
  }
  tpl() {
    return this.iframes
  }
  init() {
    this.iframes.forEach((t, n) => {
      t.onload = r => this.onload(r)
    }),
      Jt(this.el, t => {
        this.iframes.forEach(n => {
          const r = n.style
          ;(r.width = t.contentRect.width + 'px'), (r.height = t.contentRect.height + 'px')
        })
      })
  }
}
function fn(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, 'default') ? e.default : e
}
function er(e) {
  var t = e.default
  if (typeof t == 'function') {
    var n = function () {
      return t.apply(this, arguments)
    }
    n.prototype = t.prototype
  } else n = {}
  return (
    Object.defineProperty(n, '__esModule', { value: !0 }),
    Object.keys(e).forEach(function (r) {
      var o = Object.getOwnPropertyDescriptor(e, r)
      Object.defineProperty(
        n,
        r,
        o.get
          ? o
          : {
              enumerable: !0,
              get: function () {
                return e[r]
              },
            },
      )
    }),
    n
  )
}
var nr = function (e) {
    var t = e.types
    const n = {
      exit(a, u) {
        var f = r(a.get('openingElement'), u)
        a.node.children.length && a.node.children.forEach(h => f.arguments.push(h)),
          a.replaceWith(t.inherits(f, a.node))
      },
    }
    return {
      visitor: {
        JSXNamespacedName(a) {
          throw a.buildCodeFrameError(`Namespaced tags/attributes are not supported. JSX is not XML.
For attributes like xlink:href, use xlinkHref instead.`)
        },
        JSXFragment: n,
        JSXElement: n,
      },
    }
    function r(a, u) {
      u.opts.addArrow && l(a.parent.children), (a.parent.children = t.react.buildChildren(a.parent))
      var f = o(a.node ? a.node.name : t.NullLiteral(), a.node),
        h = [],
        p
      t.isIdentifier(f) ? (p = f.name) : t.isLiteral(f) && (p = f.value),
        t.react.isCompatTag(p) ? h.push(t.stringLiteral(p)) : h.push(f)
      var d = t.NullLiteral()
      return (
        a.node && ((d = a.node.attributes), d.length ? (d = s(d, u)) : (d = t.nullLiteral())),
        h.push(d),
        t.callExpression(t.identifier('h'), h)
      )
    }
    function o(a, u) {
      return (
        t.isJSXIdentifier(a)
          ? a.name === 'this' && t.isReferenced(a, u)
            ? (a = t.thisExpression())
            : (a.type = 'Identifier')
          : t.isJSXMemberExpression(a) && (a = t.memberExpression(o(a.object, a), o(a.property, a))),
        a
      )
    }
    function s(a, u) {
      for (var f = []; a.length; ) {
        var h = a.shift()
        t.isJSXSpreadAttribute(h)
          ? ((h.argument._isSpread = !0), f.push(t.spreadProperty(h.argument)))
          : f.push(i(h, u.opts.addArrow))
      }
      return (a = t.objectExpression(f)), a
    }
    function i(a, u) {
      var f = c(a.value || t.booleanLiteral(!0))
      return (
        t.isStringLiteral(f) &&
          !t.isJSXExpressionContainer(a.value) &&
          (f.value = f.value.replace(/\n\s+/g, ' ')),
        t.isValidIdentifier(a.name.name)
          ? (a.name.type = 'Identifier')
          : (a.name = t.stringLiteral(a.name.name)),
        u && t.isJSXExpressionContainer(a.value) && (f = t.arrowFunctionExpression([], f)),
        t.inherits(t.objectProperty(a.name, f), a)
      )
    }
    function c(a) {
      return t.isJSXExpressionContainer(a) ? a.expression : a
    }
    function l(a) {
      for (var u = 0; u < a.length; u++)
        t.isJSXExpressionContainer(a[u]) && (a[u].expression = t.arrowFunctionExpression([], a[u].expression))
    }
  },
  Xt = { exports: {} }
;(function (e, t) {
  ;(t.__esModule = !0),
    (t.default = function () {
      return {
        manipulateOptions: function (r, o) {
          o.plugins.push('jsx')
        },
      }
    }),
    (e.exports = t.default)
})(Xt, Xt.exports)
const rr = fn(Xt.exports),
  or = 1500,
  sr = ({ types: e, template: t }) => {
    const n = t(`
    if (ITERATOR++ > MAX_ITERATIONS) {
      throw new RangeError(
        'Potential infinite loop: exceeded ' +
        MAX_ITERATIONS +
        ' iterations.'
      );
    }
  `)
    return {
      visitor: {
        'WhileStatement|ForStatement|DoWhileStatement': (r, o) => {
          const s = r.scope.parent.generateUidIdentifier('loopIt'),
            i = e.numericLiteral(0)
          r.scope.parent.push({ id: s, init: i })
          const c = n({ ITERATOR: s, MAX_ITERATIONS: e.numericLiteral(or) })
          if (r.get('body').isBlockStatement()) r.get('body').unshiftContainer('body', c)
          else {
            const l = r.get('body').node
            r.get('body').replaceWith(e.blockStatement([c, l]))
          }
        },
      },
    }
  },
  cr = () => {
    throw new Error('Babel module is missing. Please load bable module and call setBabelModule')
  }
let pn = { transform: cr }
function ir(e) {
  pn = e
  const { availablePlugins: t } = e
  ;(t['jsx-mi2'] = nr), (t['syntax-jsx'] = rr), (t.preventInfiniteLoops = sr)
}
const lr = {
  retainLines: !0,
  plugins: ['syntax-jsx', 'jsx-mi2', 'syntax-object-rest-spread', 'preventInfiniteLoops'],
  presets: [],
}
function hn(e = {}, t = {}) {
  for (let n in t)
    e[n]
      ? t[n] instanceof Array
        ? (e[n] = [...e[n], ...t[n]])
        : (e[n] = { ...e[n], ...t[n] })
      : (e[n] = t[n])
}
function dn(e, t = {}, n = {}) {
  const r = { ...lr, ...t }
  return hn(r, n), pn.transform(e, r)
}
const Qt = (e, t = {}, n = {}) => (
  (t = { sourceMaps: 'inline', ...t }), hn(n, { plugins: ['transform-modules-commonjs'] }), dn(e, t, n)
)
function ar(e) {
  var t = new XMLHttpRequest()
  if ((t.open('GET', e, 0), t.send(), t.status && t.status !== 200)) throw new Error(t.statusText)
  return t.responseText
}
function z(e) {
  z.urlAlias[e] && (e = z.urlAlias[e]),
    e.startsWith('http') || e.startsWith('./') || (e = 'https://unpkg.com/' + e),
    this.___require_cache || (this.___require_cache = {})
  var t = this.___require_cache[e]
  if (!t) {
    let n = this.requireModule(e)
    this.___require_cache[e] = t = n.exports
  }
  return t
}
function ur(e, t) {
  try {
    const n = {}
    ;(t = t || this.requireFile(e)), (t = Qt(t, { filename: '' + e }).code)
    const r = { id: e, uri: e, exports: n, source: t }
    return new this.Function('require', 'exports', 'module', t).bind(this)(z, n, r), r
  } catch (n) {
    throw (
      (console.error(
        'Error loading module ' +
          e +
          ': ' +
          n.message +
          `
`,
        n.stack,
        n,
      ),
      console.log(t),
      n)
    )
  }
}
z.cache = {}
z.urlAlias = {}
z.alias = (e, t) => {
  const n = z.cache
  ;(n[e] = n[t]), e.toLowerCase().substr(-3) !== '.js' && (z.cache[e + '.js'] = n[t]), (z.urlAlias[e] = t)
}
z.alias('@jsx6/jsx6', './dist/jsx6.js')
function Ct(e, t) {
  console.log(`
****************************************
**********************  RUN CODE  ******
****************************************
`)
  const n = t.contentWindow
  ;(n.requireFile = ar.bind(n)), (n.require = z.bind(n)), (n.requireModule = ur.bind(n)), n.eval(e)
}
const ve = e => {
  let t = 0
  for (let n = 0; n < e.length; ++n)
    e[n] ==
      `
` && t++
  return t
}
function fr(e, t) {
  const n = ve(e),
    r = ve(t)
  if (n > r) {
    const o = [t]
    for (let s = r; s < n; s++)
      o.push(`
`)
    t = o.join('')
  }
  return t
}
let _e,
  bt = 100
const xt = 1e3
let kt = bt,
  xe
function pr(e, t, { otherEditor: n, codeRunner: r = Ct }) {
  clearTimeout(_e),
    clearTimeout(xe),
    (_e = setTimeout(() => {
      try {
        hr(e, t, { otherEditor: n, codeRunner: r })
      } catch (o) {
        if (o.toString().includes('SyntaxError'))
          xe = setTimeout(() => {
            throw o
          }, xt)
        else throw ((kt = xt), o)
      }
    }, kt))
}
function hr(e, t, { otherEditor: n, codeRunner: r = Ct }) {
  const o = t.getValue()
  let s = n ? dn(o, {}).code : ''
  n && ((s = fr(o, s)), n.setValue(s)),
    e.waitNext(!1).then(i => {
      try {
        let c = Date.now()
        r(o, i), (c = Date.now() - c), c >= bt - 10 ? (c = Math.min(c + bt, xt)) : (kt = bt)
      } catch (c) {
        throw ((kt = xt), c)
      } finally {
        setTimeout(() => {
          e.applyVisibility()
        }, 50)
      }
    })
}
function dr(e, t = {}) {
  var n
  ;(n = e.sections) == null ||
    n.forEach(r => {
      var o
      ;(o = r.lines) == null ||
        o.forEach(s => {
          var i, c
          if (s.code !== void 0) {
            const l = (i = s.info) == null ? void 0 : i.import
            if (l) {
              const a = t[l]
              a
                ? ((s.lines = s.lines.concat(a.lines)),
                  (s.info = { ...a.info, ...s.info, hidden: (c = s.info) == null ? void 0 : c.hidden }),
                  delete s.info.import)
                : console.log('import not found', l)
            }
          }
        })
    })
}
var gn = { exports: {} },
  E = {},
  te = { exports: {} }
const gr = '\xC1',
  mr = '\xE1',
  br = '\u0102',
  vr = '\u0103',
  _r = '\u223E',
  xr = '\u223F',
  kr = '\u223E\u0333',
  yr = '\xC2',
  wr = '\xE2',
  Cr = '\xB4',
  Ar = '\u0410',
  Er = '\u0430',
  Dr = '\xC6',
  qr = '\xE6',
  Sr = '\u2061',
  Tr = '\u{1D504}',
  Rr = '\u{1D51E}',
  Lr = '\xC0',
  Fr = '\xE0',
  Mr = '\u2135',
  Ir = '\u2135',
  zr = '\u0391',
  Pr = '\u03B1',
  Br = '\u0100',
  Nr = '\u0101',
  Or = '\u2A3F',
  Hr = '&',
  Ur = '&',
  jr = '\u2A55',
  Vr = '\u2A53',
  $r = '\u2227',
  Xr = '\u2A5C',
  Yr = '\u2A58',
  Wr = '\u2A5A',
  Gr = '\u2220',
  Zr = '\u29A4',
  Jr = '\u2220',
  Kr = '\u29A8',
  Qr = '\u29A9',
  to = '\u29AA',
  eo = '\u29AB',
  no = '\u29AC',
  ro = '\u29AD',
  oo = '\u29AE',
  so = '\u29AF',
  co = '\u2221',
  io = '\u221F',
  lo = '\u22BE',
  ao = '\u299D',
  uo = '\u2222',
  fo = '\xC5',
  po = '\u237C',
  ho = '\u0104',
  go = '\u0105',
  mo = '\u{1D538}',
  bo = '\u{1D552}',
  vo = '\u2A6F',
  _o = '\u2248',
  xo = '\u2A70',
  ko = '\u224A',
  yo = '\u224B',
  wo = "'",
  Co = '\u2061',
  Ao = '\u2248',
  Eo = '\u224A',
  Do = '\xC5',
  qo = '\xE5',
  So = '\u{1D49C}',
  To = '\u{1D4B6}',
  Ro = '\u2254',
  Lo = '*',
  Fo = '\u2248',
  Mo = '\u224D',
  Io = '\xC3',
  zo = '\xE3',
  Po = '\xC4',
  Bo = '\xE4',
  No = '\u2233',
  Oo = '\u2A11',
  Ho = '\u224C',
  Uo = '\u03F6',
  jo = '\u2035',
  Vo = '\u223D',
  $o = '\u22CD',
  Xo = '\u2216',
  Yo = '\u2AE7',
  Wo = '\u22BD',
  Go = '\u2305',
  Zo = '\u2306',
  Jo = '\u2305',
  Ko = '\u23B5',
  Qo = '\u23B6',
  ts = '\u224C',
  es = '\u0411',
  ns = '\u0431',
  rs = '\u201E',
  os = '\u2235',
  ss = '\u2235',
  cs = '\u2235',
  is = '\u29B0',
  ls = '\u03F6',
  as = '\u212C',
  us = '\u212C',
  fs = '\u0392',
  ps = '\u03B2',
  hs = '\u2136',
  ds = '\u226C',
  gs = '\u{1D505}',
  ms = '\u{1D51F}',
  bs = '\u22C2',
  vs = '\u25EF',
  _s = '\u22C3',
  xs = '\u2A00',
  ks = '\u2A01',
  ys = '\u2A02',
  ws = '\u2A06',
  Cs = '\u2605',
  As = '\u25BD',
  Es = '\u25B3',
  Ds = '\u2A04',
  qs = '\u22C1',
  Ss = '\u22C0',
  Ts = '\u290D',
  Rs = '\u29EB',
  Ls = '\u25AA',
  Fs = '\u25B4',
  Ms = '\u25BE',
  Is = '\u25C2',
  zs = '\u25B8',
  Ps = '\u2423',
  Bs = '\u2592',
  Ns = '\u2591',
  Os = '\u2593',
  Hs = '\u2588',
  Us = '=\u20E5',
  js = '\u2261\u20E5',
  Vs = '\u2AED',
  $s = '\u2310',
  Xs = '\u{1D539}',
  Ys = '\u{1D553}',
  Ws = '\u22A5',
  Gs = '\u22A5',
  Zs = '\u22C8',
  Js = '\u29C9',
  Ks = '\u2510',
  Qs = '\u2555',
  tc = '\u2556',
  ec = '\u2557',
  nc = '\u250C',
  rc = '\u2552',
  oc = '\u2553',
  sc = '\u2554',
  cc = '\u2500',
  ic = '\u2550',
  lc = '\u252C',
  ac = '\u2564',
  uc = '\u2565',
  fc = '\u2566',
  pc = '\u2534',
  hc = '\u2567',
  dc = '\u2568',
  gc = '\u2569',
  mc = '\u229F',
  bc = '\u229E',
  vc = '\u22A0',
  _c = '\u2518',
  xc = '\u255B',
  kc = '\u255C',
  yc = '\u255D',
  wc = '\u2514',
  Cc = '\u2558',
  Ac = '\u2559',
  Ec = '\u255A',
  Dc = '\u2502',
  qc = '\u2551',
  Sc = '\u253C',
  Tc = '\u256A',
  Rc = '\u256B',
  Lc = '\u256C',
  Fc = '\u2524',
  Mc = '\u2561',
  Ic = '\u2562',
  zc = '\u2563',
  Pc = '\u251C',
  Bc = '\u255E',
  Nc = '\u255F',
  Oc = '\u2560',
  Hc = '\u2035',
  Uc = '\u02D8',
  jc = '\u02D8',
  Vc = '\xA6',
  $c = '\u{1D4B7}',
  Xc = '\u212C',
  Yc = '\u204F',
  Wc = '\u223D',
  Gc = '\u22CD',
  Zc = '\u29C5',
  Jc = '\\',
  Kc = '\u27C8',
  Qc = '\u2022',
  ti = '\u2022',
  ei = '\u224E',
  ni = '\u2AAE',
  ri = '\u224F',
  oi = '\u224E',
  si = '\u224F',
  ci = '\u0106',
  ii = '\u0107',
  li = '\u2A44',
  ai = '\u2A49',
  ui = '\u2A4B',
  fi = '\u2229',
  pi = '\u22D2',
  hi = '\u2A47',
  di = '\u2A40',
  gi = '\u2145',
  mi = '\u2229\uFE00',
  bi = '\u2041',
  vi = '\u02C7',
  _i = '\u212D',
  xi = '\u2A4D',
  ki = '\u010C',
  yi = '\u010D',
  wi = '\xC7',
  Ci = '\xE7',
  Ai = '\u0108',
  Ei = '\u0109',
  Di = '\u2230',
  qi = '\u2A4C',
  Si = '\u2A50',
  Ti = '\u010A',
  Ri = '\u010B',
  Li = '\xB8',
  Fi = '\xB8',
  Mi = '\u29B2',
  Ii = '\xA2',
  zi = '\xB7',
  Pi = '\xB7',
  Bi = '\u{1D520}',
  Ni = '\u212D',
  Oi = '\u0427',
  Hi = '\u0447',
  Ui = '\u2713',
  ji = '\u2713',
  Vi = '\u03A7',
  $i = '\u03C7',
  Xi = '\u02C6',
  Yi = '\u2257',
  Wi = '\u21BA',
  Gi = '\u21BB',
  Zi = '\u229B',
  Ji = '\u229A',
  Ki = '\u229D',
  Qi = '\u2299',
  tl = '\xAE',
  el = '\u24C8',
  nl = '\u2296',
  rl = '\u2295',
  ol = '\u2297',
  sl = '\u25CB',
  cl = '\u29C3',
  il = '\u2257',
  ll = '\u2A10',
  al = '\u2AEF',
  ul = '\u29C2',
  fl = '\u2232',
  pl = '\u201D',
  hl = '\u2019',
  dl = '\u2663',
  gl = '\u2663',
  ml = ':',
  bl = '\u2237',
  vl = '\u2A74',
  _l = '\u2254',
  xl = '\u2254',
  kl = ',',
  yl = '@',
  wl = '\u2201',
  Cl = '\u2218',
  Al = '\u2201',
  El = '\u2102',
  Dl = '\u2245',
  ql = '\u2A6D',
  Sl = '\u2261',
  Tl = '\u222E',
  Rl = '\u222F',
  Ll = '\u222E',
  Fl = '\u{1D554}',
  Ml = '\u2102',
  Il = '\u2210',
  zl = '\u2210',
  Pl = '\xA9',
  Bl = '\xA9',
  Nl = '\u2117',
  Ol = '\u2233',
  Hl = '\u21B5',
  Ul = '\u2717',
  jl = '\u2A2F',
  Vl = '\u{1D49E}',
  $l = '\u{1D4B8}',
  Xl = '\u2ACF',
  Yl = '\u2AD1',
  Wl = '\u2AD0',
  Gl = '\u2AD2',
  Zl = '\u22EF',
  Jl = '\u2938',
  Kl = '\u2935',
  Ql = '\u22DE',
  ta = '\u22DF',
  ea = '\u21B6',
  na = '\u293D',
  ra = '\u2A48',
  oa = '\u2A46',
  sa = '\u224D',
  ca = '\u222A',
  ia = '\u22D3',
  la = '\u2A4A',
  aa = '\u228D',
  ua = '\u2A45',
  fa = '\u222A\uFE00',
  pa = '\u21B7',
  ha = '\u293C',
  da = '\u22DE',
  ga = '\u22DF',
  ma = '\u22CE',
  ba = '\u22CF',
  va = '\xA4',
  _a = '\u21B6',
  xa = '\u21B7',
  ka = '\u22CE',
  ya = '\u22CF',
  wa = '\u2232',
  Ca = '\u2231',
  Aa = '\u232D',
  Ea = '\u2020',
  Da = '\u2021',
  qa = '\u2138',
  Sa = '\u2193',
  Ta = '\u21A1',
  Ra = '\u21D3',
  La = '\u2010',
  Fa = '\u2AE4',
  Ma = '\u22A3',
  Ia = '\u290F',
  za = '\u02DD',
  Pa = '\u010E',
  Ba = '\u010F',
  Na = '\u0414',
  Oa = '\u0434',
  Ha = '\u2021',
  Ua = '\u21CA',
  ja = '\u2145',
  Va = '\u2146',
  $a = '\u2911',
  Xa = '\u2A77',
  Ya = '\xB0',
  Wa = '\u2207',
  Ga = '\u0394',
  Za = '\u03B4',
  Ja = '\u29B1',
  Ka = '\u297F',
  Qa = '\u{1D507}',
  tu = '\u{1D521}',
  eu = '\u2965',
  nu = '\u21C3',
  ru = '\u21C2',
  ou = '\xB4',
  su = '\u02D9',
  cu = '\u02DD',
  iu = '`',
  lu = '\u02DC',
  au = '\u22C4',
  uu = '\u22C4',
  fu = '\u22C4',
  pu = '\u2666',
  hu = '\u2666',
  du = '\xA8',
  gu = '\u2146',
  mu = '\u03DD',
  bu = '\u22F2',
  vu = '\xF7',
  _u = '\xF7',
  xu = '\u22C7',
  ku = '\u22C7',
  yu = '\u0402',
  wu = '\u0452',
  Cu = '\u231E',
  Au = '\u230D',
  Eu = '$',
  Du = '\u{1D53B}',
  qu = '\u{1D555}',
  Su = '\xA8',
  Tu = '\u02D9',
  Ru = '\u20DC',
  Lu = '\u2250',
  Fu = '\u2251',
  Mu = '\u2250',
  Iu = '\u2238',
  zu = '\u2214',
  Pu = '\u22A1',
  Bu = '\u2306',
  Nu = '\u222F',
  Ou = '\xA8',
  Hu = '\u21D3',
  Uu = '\u21D0',
  ju = '\u21D4',
  Vu = '\u2AE4',
  $u = '\u27F8',
  Xu = '\u27FA',
  Yu = '\u27F9',
  Wu = '\u21D2',
  Gu = '\u22A8',
  Zu = '\u21D1',
  Ju = '\u21D5',
  Ku = '\u2225',
  Qu = '\u2913',
  tf = '\u2193',
  ef = '\u2193',
  nf = '\u21D3',
  rf = '\u21F5',
  of = '\u0311',
  sf = '\u21CA',
  cf = '\u21C3',
  lf = '\u21C2',
  af = '\u2950',
  uf = '\u295E',
  ff = '\u2956',
  pf = '\u21BD',
  hf = '\u295F',
  df = '\u2957',
  gf = '\u21C1',
  mf = '\u21A7',
  bf = '\u22A4',
  vf = '\u2910',
  _f = '\u231F',
  xf = '\u230C',
  kf = '\u{1D49F}',
  yf = '\u{1D4B9}',
  wf = '\u0405',
  Cf = '\u0455',
  Af = '\u29F6',
  Ef = '\u0110',
  Df = '\u0111',
  qf = '\u22F1',
  Sf = '\u25BF',
  Tf = '\u25BE',
  Rf = '\u21F5',
  Lf = '\u296F',
  Ff = '\u29A6',
  Mf = '\u040F',
  If = '\u045F',
  zf = '\u27FF',
  Pf = '\xC9',
  Bf = '\xE9',
  Nf = '\u2A6E',
  Of = '\u011A',
  Hf = '\u011B',
  Uf = '\xCA',
  jf = '\xEA',
  Vf = '\u2256',
  $f = '\u2255',
  Xf = '\u042D',
  Yf = '\u044D',
  Wf = '\u2A77',
  Gf = '\u0116',
  Zf = '\u0117',
  Jf = '\u2251',
  Kf = '\u2147',
  Qf = '\u2252',
  tp = '\u{1D508}',
  ep = '\u{1D522}',
  np = '\u2A9A',
  rp = '\xC8',
  op = '\xE8',
  sp = '\u2A96',
  cp = '\u2A98',
  ip = '\u2A99',
  lp = '\u2208',
  ap = '\u23E7',
  up = '\u2113',
  fp = '\u2A95',
  pp = '\u2A97',
  hp = '\u0112',
  dp = '\u0113',
  gp = '\u2205',
  mp = '\u2205',
  bp = '\u25FB',
  vp = '\u2205',
  _p = '\u25AB',
  xp = '\u2004',
  kp = '\u2005',
  yp = '\u2003',
  wp = '\u014A',
  Cp = '\u014B',
  Ap = '\u2002',
  Ep = '\u0118',
  Dp = '\u0119',
  qp = '\u{1D53C}',
  Sp = '\u{1D556}',
  Tp = '\u22D5',
  Rp = '\u29E3',
  Lp = '\u2A71',
  Fp = '\u03B5',
  Mp = '\u0395',
  Ip = '\u03B5',
  zp = '\u03F5',
  Pp = '\u2256',
  Bp = '\u2255',
  Np = '\u2242',
  Op = '\u2A96',
  Hp = '\u2A95',
  Up = '\u2A75',
  jp = '=',
  Vp = '\u2242',
  $p = '\u225F',
  Xp = '\u21CC',
  Yp = '\u2261',
  Wp = '\u2A78',
  Gp = '\u29E5',
  Zp = '\u2971',
  Jp = '\u2253',
  Kp = '\u212F',
  Qp = '\u2130',
  th = '\u2250',
  eh = '\u2A73',
  nh = '\u2242',
  rh = '\u0397',
  oh = '\u03B7',
  sh = '\xD0',
  ch = '\xF0',
  ih = '\xCB',
  lh = '\xEB',
  ah = '\u20AC',
  uh = '!',
  fh = '\u2203',
  ph = '\u2203',
  hh = '\u2130',
  dh = '\u2147',
  gh = '\u2147',
  mh = '\u2252',
  bh = '\u0424',
  vh = '\u0444',
  _h = '\u2640',
  xh = '\uFB03',
  kh = '\uFB00',
  yh = '\uFB04',
  wh = '\u{1D509}',
  Ch = '\u{1D523}',
  Ah = '\uFB01',
  Eh = '\u25FC',
  Dh = '\u25AA',
  qh = 'fj',
  Sh = '\u266D',
  Th = '\uFB02',
  Rh = '\u25B1',
  Lh = '\u0192',
  Fh = '\u{1D53D}',
  Mh = '\u{1D557}',
  Ih = '\u2200',
  zh = '\u2200',
  Ph = '\u22D4',
  Bh = '\u2AD9',
  Nh = '\u2131',
  Oh = '\u2A0D',
  Hh = '\xBD',
  Uh = '\u2153',
  jh = '\xBC',
  Vh = '\u2155',
  $h = '\u2159',
  Xh = '\u215B',
  Yh = '\u2154',
  Wh = '\u2156',
  Gh = '\xBE',
  Zh = '\u2157',
  Jh = '\u215C',
  Kh = '\u2158',
  Qh = '\u215A',
  td = '\u215D',
  ed = '\u215E',
  nd = '\u2044',
  rd = '\u2322',
  od = '\u{1D4BB}',
  sd = '\u2131',
  cd = '\u01F5',
  id = '\u0393',
  ld = '\u03B3',
  ad = '\u03DC',
  ud = '\u03DD',
  fd = '\u2A86',
  pd = '\u011E',
  hd = '\u011F',
  dd = '\u0122',
  gd = '\u011C',
  md = '\u011D',
  bd = '\u0413',
  vd = '\u0433',
  _d = '\u0120',
  xd = '\u0121',
  kd = '\u2265',
  yd = '\u2267',
  wd = '\u2A8C',
  Cd = '\u22DB',
  Ad = '\u2265',
  Ed = '\u2267',
  Dd = '\u2A7E',
  qd = '\u2AA9',
  Sd = '\u2A7E',
  Td = '\u2A80',
  Rd = '\u2A82',
  Ld = '\u2A84',
  Fd = '\u22DB\uFE00',
  Md = '\u2A94',
  Id = '\u{1D50A}',
  zd = '\u{1D524}',
  Pd = '\u226B',
  Bd = '\u22D9',
  Nd = '\u22D9',
  Od = '\u2137',
  Hd = '\u0403',
  Ud = '\u0453',
  jd = '\u2AA5',
  Vd = '\u2277',
  $d = '\u2A92',
  Xd = '\u2AA4',
  Yd = '\u2A8A',
  Wd = '\u2A8A',
  Gd = '\u2A88',
  Zd = '\u2269',
  Jd = '\u2A88',
  Kd = '\u2269',
  Qd = '\u22E7',
  tg = '\u{1D53E}',
  eg = '\u{1D558}',
  ng = '`',
  rg = '\u2265',
  og = '\u22DB',
  sg = '\u2267',
  cg = '\u2AA2',
  ig = '\u2277',
  lg = '\u2A7E',
  ag = '\u2273',
  ug = '\u{1D4A2}',
  fg = '\u210A',
  pg = '\u2273',
  hg = '\u2A8E',
  dg = '\u2A90',
  gg = '\u2AA7',
  mg = '\u2A7A',
  bg = '>',
  vg = '>',
  _g = '\u226B',
  xg = '\u22D7',
  kg = '\u2995',
  yg = '\u2A7C',
  wg = '\u2A86',
  Cg = '\u2978',
  Ag = '\u22D7',
  Eg = '\u22DB',
  Dg = '\u2A8C',
  qg = '\u2277',
  Sg = '\u2273',
  Tg = '\u2269\uFE00',
  Rg = '\u2269\uFE00',
  Lg = '\u02C7',
  Fg = '\u200A',
  Mg = '\xBD',
  Ig = '\u210B',
  zg = '\u042A',
  Pg = '\u044A',
  Bg = '\u2948',
  Ng = '\u2194',
  Og = '\u21D4',
  Hg = '\u21AD',
  Ug = '^',
  jg = '\u210F',
  Vg = '\u0124',
  $g = '\u0125',
  Xg = '\u2665',
  Yg = '\u2665',
  Wg = '\u2026',
  Gg = '\u22B9',
  Zg = '\u{1D525}',
  Jg = '\u210C',
  Kg = '\u210B',
  Qg = '\u2925',
  tm = '\u2926',
  em = '\u21FF',
  nm = '\u223B',
  rm = '\u21A9',
  om = '\u21AA',
  sm = '\u{1D559}',
  cm = '\u210D',
  im = '\u2015',
  lm = '\u2500',
  am = '\u{1D4BD}',
  um = '\u210B',
  fm = '\u210F',
  pm = '\u0126',
  hm = '\u0127',
  dm = '\u224E',
  gm = '\u224F',
  mm = '\u2043',
  bm = '\u2010',
  vm = '\xCD',
  _m = '\xED',
  xm = '\u2063',
  km = '\xCE',
  ym = '\xEE',
  wm = '\u0418',
  Cm = '\u0438',
  Am = '\u0130',
  Em = '\u0415',
  Dm = '\u0435',
  qm = '\xA1',
  Sm = '\u21D4',
  Tm = '\u{1D526}',
  Rm = '\u2111',
  Lm = '\xCC',
  Fm = '\xEC',
  Mm = '\u2148',
  Im = '\u2A0C',
  zm = '\u222D',
  Pm = '\u29DC',
  Bm = '\u2129',
  Nm = '\u0132',
  Om = '\u0133',
  Hm = '\u012A',
  Um = '\u012B',
  jm = '\u2111',
  Vm = '\u2148',
  $m = '\u2110',
  Xm = '\u2111',
  Ym = '\u0131',
  Wm = '\u2111',
  Gm = '\u22B7',
  Zm = '\u01B5',
  Jm = '\u21D2',
  Km = '\u2105',
  Qm = '\u221E',
  tb = '\u29DD',
  eb = '\u0131',
  nb = '\u22BA',
  rb = '\u222B',
  ob = '\u222C',
  sb = '\u2124',
  cb = '\u222B',
  ib = '\u22BA',
  lb = '\u22C2',
  ab = '\u2A17',
  ub = '\u2A3C',
  fb = '\u2063',
  pb = '\u2062',
  hb = '\u0401',
  db = '\u0451',
  gb = '\u012E',
  mb = '\u012F',
  bb = '\u{1D540}',
  vb = '\u{1D55A}',
  _b = '\u0399',
  xb = '\u03B9',
  kb = '\u2A3C',
  yb = '\xBF',
  wb = '\u{1D4BE}',
  Cb = '\u2110',
  Ab = '\u2208',
  Eb = '\u22F5',
  Db = '\u22F9',
  qb = '\u22F4',
  Sb = '\u22F3',
  Tb = '\u2208',
  Rb = '\u2062',
  Lb = '\u0128',
  Fb = '\u0129',
  Mb = '\u0406',
  Ib = '\u0456',
  zb = '\xCF',
  Pb = '\xEF',
  Bb = '\u0134',
  Nb = '\u0135',
  Ob = '\u0419',
  Hb = '\u0439',
  Ub = '\u{1D50D}',
  jb = '\u{1D527}',
  Vb = '\u0237',
  $b = '\u{1D541}',
  Xb = '\u{1D55B}',
  Yb = '\u{1D4A5}',
  Wb = '\u{1D4BF}',
  Gb = '\u0408',
  Zb = '\u0458',
  Jb = '\u0404',
  Kb = '\u0454',
  Qb = '\u039A',
  t0 = '\u03BA',
  e0 = '\u03F0',
  n0 = '\u0136',
  r0 = '\u0137',
  o0 = '\u041A',
  s0 = '\u043A',
  c0 = '\u{1D50E}',
  i0 = '\u{1D528}',
  l0 = '\u0138',
  a0 = '\u0425',
  u0 = '\u0445',
  f0 = '\u040C',
  p0 = '\u045C',
  h0 = '\u{1D542}',
  d0 = '\u{1D55C}',
  g0 = '\u{1D4A6}',
  m0 = '\u{1D4C0}',
  b0 = '\u21DA',
  v0 = '\u0139',
  _0 = '\u013A',
  x0 = '\u29B4',
  k0 = '\u2112',
  y0 = '\u039B',
  w0 = '\u03BB',
  C0 = '\u27E8',
  A0 = '\u27EA',
  E0 = '\u2991',
  D0 = '\u27E8',
  q0 = '\u2A85',
  S0 = '\u2112',
  T0 = '\xAB',
  R0 = '\u21E4',
  L0 = '\u291F',
  F0 = '\u2190',
  M0 = '\u219E',
  I0 = '\u21D0',
  z0 = '\u291D',
  P0 = '\u21A9',
  B0 = '\u21AB',
  N0 = '\u2939',
  O0 = '\u2973',
  H0 = '\u21A2',
  U0 = '\u2919',
  j0 = '\u291B',
  V0 = '\u2AAB',
  $0 = '\u2AAD',
  X0 = '\u2AAD\uFE00',
  Y0 = '\u290C',
  W0 = '\u290E',
  G0 = '\u2772',
  Z0 = '{',
  J0 = '[',
  K0 = '\u298B',
  Q0 = '\u298F',
  tv = '\u298D',
  ev = '\u013D',
  nv = '\u013E',
  rv = '\u013B',
  ov = '\u013C',
  sv = '\u2308',
  cv = '{',
  iv = '\u041B',
  lv = '\u043B',
  av = '\u2936',
  uv = '\u201C',
  fv = '\u201E',
  pv = '\u2967',
  hv = '\u294B',
  dv = '\u21B2',
  gv = '\u2264',
  mv = '\u2266',
  bv = '\u27E8',
  vv = '\u21E4',
  _v = '\u2190',
  xv = '\u2190',
  kv = '\u21D0',
  yv = '\u21C6',
  wv = '\u21A2',
  Cv = '\u2308',
  Av = '\u27E6',
  Ev = '\u2961',
  Dv = '\u2959',
  qv = '\u21C3',
  Sv = '\u230A',
  Tv = '\u21BD',
  Rv = '\u21BC',
  Lv = '\u21C7',
  Fv = '\u2194',
  Mv = '\u2194',
  Iv = '\u21D4',
  zv = '\u21C6',
  Pv = '\u21CB',
  Bv = '\u21AD',
  Nv = '\u294E',
  Ov = '\u21A4',
  Hv = '\u22A3',
  Uv = '\u295A',
  jv = '\u22CB',
  Vv = '\u29CF',
  $v = '\u22B2',
  Xv = '\u22B4',
  Yv = '\u2951',
  Wv = '\u2960',
  Gv = '\u2958',
  Zv = '\u21BF',
  Jv = '\u2952',
  Kv = '\u21BC',
  Qv = '\u2A8B',
  t_ = '\u22DA',
  e_ = '\u2264',
  n_ = '\u2266',
  r_ = '\u2A7D',
  o_ = '\u2AA8',
  s_ = '\u2A7D',
  c_ = '\u2A7F',
  i_ = '\u2A81',
  l_ = '\u2A83',
  a_ = '\u22DA\uFE00',
  u_ = '\u2A93',
  f_ = '\u2A85',
  p_ = '\u22D6',
  h_ = '\u22DA',
  d_ = '\u2A8B',
  g_ = '\u22DA',
  m_ = '\u2266',
  b_ = '\u2276',
  v_ = '\u2276',
  __ = '\u2AA1',
  x_ = '\u2272',
  k_ = '\u2A7D',
  y_ = '\u2272',
  w_ = '\u297C',
  C_ = '\u230A',
  A_ = '\u{1D50F}',
  E_ = '\u{1D529}',
  D_ = '\u2276',
  q_ = '\u2A91',
  S_ = '\u2962',
  T_ = '\u21BD',
  R_ = '\u21BC',
  L_ = '\u296A',
  F_ = '\u2584',
  M_ = '\u0409',
  I_ = '\u0459',
  z_ = '\u21C7',
  P_ = '\u226A',
  B_ = '\u22D8',
  N_ = '\u231E',
  O_ = '\u21DA',
  H_ = '\u296B',
  U_ = '\u25FA',
  j_ = '\u013F',
  V_ = '\u0140',
  $_ = '\u23B0',
  X_ = '\u23B0',
  Y_ = '\u2A89',
  W_ = '\u2A89',
  G_ = '\u2A87',
  Z_ = '\u2268',
  J_ = '\u2A87',
  K_ = '\u2268',
  Q_ = '\u22E6',
  tx = '\u27EC',
  ex = '\u21FD',
  nx = '\u27E6',
  rx = '\u27F5',
  ox = '\u27F5',
  sx = '\u27F8',
  cx = '\u27F7',
  ix = '\u27F7',
  lx = '\u27FA',
  ax = '\u27FC',
  ux = '\u27F6',
  fx = '\u27F6',
  px = '\u27F9',
  hx = '\u21AB',
  dx = '\u21AC',
  gx = '\u2985',
  mx = '\u{1D543}',
  bx = '\u{1D55D}',
  vx = '\u2A2D',
  _x = '\u2A34',
  xx = '\u2217',
  kx = '_',
  yx = '\u2199',
  wx = '\u2198',
  Cx = '\u25CA',
  Ax = '\u25CA',
  Ex = '\u29EB',
  Dx = '(',
  qx = '\u2993',
  Sx = '\u21C6',
  Tx = '\u231F',
  Rx = '\u21CB',
  Lx = '\u296D',
  Fx = '\u200E',
  Mx = '\u22BF',
  Ix = '\u2039',
  zx = '\u{1D4C1}',
  Px = '\u2112',
  Bx = '\u21B0',
  Nx = '\u21B0',
  Ox = '\u2272',
  Hx = '\u2A8D',
  Ux = '\u2A8F',
  jx = '[',
  Vx = '\u2018',
  $x = '\u201A',
  Xx = '\u0141',
  Yx = '\u0142',
  Wx = '\u2AA6',
  Gx = '\u2A79',
  Zx = '<',
  Jx = '<',
  Kx = '\u226A',
  Qx = '\u22D6',
  tk = '\u22CB',
  ek = '\u22C9',
  nk = '\u2976',
  rk = '\u2A7B',
  ok = '\u25C3',
  sk = '\u22B4',
  ck = '\u25C2',
  ik = '\u2996',
  lk = '\u294A',
  ak = '\u2966',
  uk = '\u2268\uFE00',
  fk = '\u2268\uFE00',
  pk = '\xAF',
  hk = '\u2642',
  dk = '\u2720',
  gk = '\u2720',
  mk = '\u21A6',
  bk = '\u21A6',
  vk = '\u21A7',
  _k = '\u21A4',
  xk = '\u21A5',
  kk = '\u25AE',
  yk = '\u2A29',
  wk = '\u041C',
  Ck = '\u043C',
  Ak = '\u2014',
  Ek = '\u223A',
  Dk = '\u2221',
  qk = '\u205F',
  Sk = '\u2133',
  Tk = '\u{1D510}',
  Rk = '\u{1D52A}',
  Lk = '\u2127',
  Fk = '\xB5',
  Mk = '*',
  Ik = '\u2AF0',
  zk = '\u2223',
  Pk = '\xB7',
  Bk = '\u229F',
  Nk = '\u2212',
  Ok = '\u2238',
  Hk = '\u2A2A',
  Uk = '\u2213',
  jk = '\u2ADB',
  Vk = '\u2026',
  $k = '\u2213',
  Xk = '\u22A7',
  Yk = '\u{1D544}',
  Wk = '\u{1D55E}',
  Gk = '\u2213',
  Zk = '\u{1D4C2}',
  Jk = '\u2133',
  Kk = '\u223E',
  Qk = '\u039C',
  ty = '\u03BC',
  ey = '\u22B8',
  ny = '\u22B8',
  ry = '\u2207',
  oy = '\u0143',
  sy = '\u0144',
  cy = '\u2220\u20D2',
  iy = '\u2249',
  ly = '\u2A70\u0338',
  ay = '\u224B\u0338',
  uy = '\u0149',
  fy = '\u2249',
  py = '\u266E',
  hy = '\u2115',
  dy = '\u266E',
  gy = '\xA0',
  my = '\u224E\u0338',
  by = '\u224F\u0338',
  vy = '\u2A43',
  _y = '\u0147',
  xy = '\u0148',
  ky = '\u0145',
  yy = '\u0146',
  wy = '\u2247',
  Cy = '\u2A6D\u0338',
  Ay = '\u2A42',
  Ey = '\u041D',
  Dy = '\u043D',
  qy = '\u2013',
  Sy = '\u2924',
  Ty = '\u2197',
  Ry = '\u21D7',
  Ly = '\u2197',
  Fy = '\u2260',
  My = '\u2250\u0338',
  Iy = '\u200B',
  zy = '\u200B',
  Py = '\u200B',
  By = '\u200B',
  Ny = '\u2262',
  Oy = '\u2928',
  Hy = '\u2242\u0338',
  Uy = '\u226B',
  jy = '\u226A',
  Vy = `
`,
  $y = '\u2204',
  Xy = '\u2204',
  Yy = '\u{1D511}',
  Wy = '\u{1D52B}',
  Gy = '\u2267\u0338',
  Zy = '\u2271',
  Jy = '\u2271',
  Ky = '\u2267\u0338',
  Qy = '\u2A7E\u0338',
  tw = '\u2A7E\u0338',
  ew = '\u22D9\u0338',
  nw = '\u2275',
  rw = '\u226B\u20D2',
  ow = '\u226F',
  sw = '\u226F',
  cw = '\u226B\u0338',
  iw = '\u21AE',
  lw = '\u21CE',
  aw = '\u2AF2',
  uw = '\u220B',
  fw = '\u22FC',
  pw = '\u22FA',
  hw = '\u220B',
  dw = '\u040A',
  gw = '\u045A',
  mw = '\u219A',
  bw = '\u21CD',
  vw = '\u2025',
  _w = '\u2266\u0338',
  xw = '\u2270',
  kw = '\u219A',
  yw = '\u21CD',
  ww = '\u21AE',
  Cw = '\u21CE',
  Aw = '\u2270',
  Ew = '\u2266\u0338',
  Dw = '\u2A7D\u0338',
  qw = '\u2A7D\u0338',
  Sw = '\u226E',
  Tw = '\u22D8\u0338',
  Rw = '\u2274',
  Lw = '\u226A\u20D2',
  Fw = '\u226E',
  Mw = '\u22EA',
  Iw = '\u22EC',
  zw = '\u226A\u0338',
  Pw = '\u2224',
  Bw = '\u2060',
  Nw = '\xA0',
  Ow = '\u{1D55F}',
  Hw = '\u2115',
  Uw = '\u2AEC',
  jw = '\xAC',
  Vw = '\u2262',
  $w = '\u226D',
  Xw = '\u2226',
  Yw = '\u2209',
  Ww = '\u2260',
  Gw = '\u2242\u0338',
  Zw = '\u2204',
  Jw = '\u226F',
  Kw = '\u2271',
  Qw = '\u2267\u0338',
  t1 = '\u226B\u0338',
  e1 = '\u2279',
  n1 = '\u2A7E\u0338',
  r1 = '\u2275',
  o1 = '\u224E\u0338',
  s1 = '\u224F\u0338',
  c1 = '\u2209',
  i1 = '\u22F5\u0338',
  l1 = '\u22F9\u0338',
  a1 = '\u2209',
  u1 = '\u22F7',
  f1 = '\u22F6',
  p1 = '\u29CF\u0338',
  h1 = '\u22EA',
  d1 = '\u22EC',
  g1 = '\u226E',
  m1 = '\u2270',
  b1 = '\u2278',
  v1 = '\u226A\u0338',
  _1 = '\u2A7D\u0338',
  x1 = '\u2274',
  k1 = '\u2AA2\u0338',
  y1 = '\u2AA1\u0338',
  w1 = '\u220C',
  C1 = '\u220C',
  A1 = '\u22FE',
  E1 = '\u22FD',
  D1 = '\u2280',
  q1 = '\u2AAF\u0338',
  S1 = '\u22E0',
  T1 = '\u220C',
  R1 = '\u29D0\u0338',
  L1 = '\u22EB',
  F1 = '\u22ED',
  M1 = '\u228F\u0338',
  I1 = '\u22E2',
  z1 = '\u2290\u0338',
  P1 = '\u22E3',
  B1 = '\u2282\u20D2',
  N1 = '\u2288',
  O1 = '\u2281',
  H1 = '\u2AB0\u0338',
  U1 = '\u22E1',
  j1 = '\u227F\u0338',
  V1 = '\u2283\u20D2',
  $1 = '\u2289',
  X1 = '\u2241',
  Y1 = '\u2244',
  W1 = '\u2247',
  G1 = '\u2249',
  Z1 = '\u2224',
  J1 = '\u2226',
  K1 = '\u2226',
  Q1 = '\u2AFD\u20E5',
  tC = '\u2202\u0338',
  eC = '\u2A14',
  nC = '\u2280',
  rC = '\u22E0',
  oC = '\u2280',
  sC = '\u2AAF\u0338',
  cC = '\u2AAF\u0338',
  iC = '\u2933\u0338',
  lC = '\u219B',
  aC = '\u21CF',
  uC = '\u219D\u0338',
  fC = '\u219B',
  pC = '\u21CF',
  hC = '\u22EB',
  dC = '\u22ED',
  gC = '\u2281',
  mC = '\u22E1',
  bC = '\u2AB0\u0338',
  vC = '\u{1D4A9}',
  _C = '\u{1D4C3}',
  xC = '\u2224',
  kC = '\u2226',
  yC = '\u2241',
  wC = '\u2244',
  CC = '\u2244',
  AC = '\u2224',
  EC = '\u2226',
  DC = '\u22E2',
  qC = '\u22E3',
  SC = '\u2284',
  TC = '\u2AC5\u0338',
  RC = '\u2288',
  LC = '\u2282\u20D2',
  FC = '\u2288',
  MC = '\u2AC5\u0338',
  IC = '\u2281',
  zC = '\u2AB0\u0338',
  PC = '\u2285',
  BC = '\u2AC6\u0338',
  NC = '\u2289',
  OC = '\u2283\u20D2',
  HC = '\u2289',
  UC = '\u2AC6\u0338',
  jC = '\u2279',
  VC = '\xD1',
  $C = '\xF1',
  XC = '\u2278',
  YC = '\u22EA',
  WC = '\u22EC',
  GC = '\u22EB',
  ZC = '\u22ED',
  JC = '\u039D',
  KC = '\u03BD',
  QC = '#',
  tA = '\u2116',
  eA = '\u2007',
  nA = '\u224D\u20D2',
  rA = '\u22AC',
  oA = '\u22AD',
  sA = '\u22AE',
  cA = '\u22AF',
  iA = '\u2265\u20D2',
  lA = '>\u20D2',
  aA = '\u2904',
  uA = '\u29DE',
  fA = '\u2902',
  pA = '\u2264\u20D2',
  hA = '<\u20D2',
  dA = '\u22B4\u20D2',
  gA = '\u2903',
  mA = '\u22B5\u20D2',
  bA = '\u223C\u20D2',
  vA = '\u2923',
  _A = '\u2196',
  xA = '\u21D6',
  kA = '\u2196',
  yA = '\u2927',
  wA = '\xD3',
  CA = '\xF3',
  AA = '\u229B',
  EA = '\xD4',
  DA = '\xF4',
  qA = '\u229A',
  SA = '\u041E',
  TA = '\u043E',
  RA = '\u229D',
  LA = '\u0150',
  FA = '\u0151',
  MA = '\u2A38',
  IA = '\u2299',
  zA = '\u29BC',
  PA = '\u0152',
  BA = '\u0153',
  NA = '\u29BF',
  OA = '\u{1D512}',
  HA = '\u{1D52C}',
  UA = '\u02DB',
  jA = '\xD2',
  VA = '\xF2',
  $A = '\u29C1',
  XA = '\u29B5',
  YA = '\u03A9',
  WA = '\u222E',
  GA = '\u21BA',
  ZA = '\u29BE',
  JA = '\u29BB',
  KA = '\u203E',
  QA = '\u29C0',
  tE = '\u014C',
  eE = '\u014D',
  nE = '\u03A9',
  rE = '\u03C9',
  oE = '\u039F',
  sE = '\u03BF',
  cE = '\u29B6',
  iE = '\u2296',
  lE = '\u{1D546}',
  aE = '\u{1D560}',
  uE = '\u29B7',
  fE = '\u201C',
  pE = '\u2018',
  hE = '\u29B9',
  dE = '\u2295',
  gE = '\u21BB',
  mE = '\u2A54',
  bE = '\u2228',
  vE = '\u2A5D',
  _E = '\u2134',
  xE = '\u2134',
  kE = '\xAA',
  yE = '\xBA',
  wE = '\u22B6',
  CE = '\u2A56',
  AE = '\u2A57',
  EE = '\u2A5B',
  DE = '\u24C8',
  qE = '\u{1D4AA}',
  SE = '\u2134',
  TE = '\xD8',
  RE = '\xF8',
  LE = '\u2298',
  FE = '\xD5',
  ME = '\xF5',
  IE = '\u2A36',
  zE = '\u2A37',
  PE = '\u2297',
  BE = '\xD6',
  NE = '\xF6',
  OE = '\u233D',
  HE = '\u203E',
  UE = '\u23DE',
  jE = '\u23B4',
  VE = '\u23DC',
  $E = '\xB6',
  XE = '\u2225',
  YE = '\u2225',
  WE = '\u2AF3',
  GE = '\u2AFD',
  ZE = '\u2202',
  JE = '\u2202',
  KE = '\u041F',
  QE = '\u043F',
  tD = '%',
  eD = '.',
  nD = '\u2030',
  rD = '\u22A5',
  oD = '\u2031',
  sD = '\u{1D513}',
  cD = '\u{1D52D}',
  iD = '\u03A6',
  lD = '\u03C6',
  aD = '\u03D5',
  uD = '\u2133',
  fD = '\u260E',
  pD = '\u03A0',
  hD = '\u03C0',
  dD = '\u22D4',
  gD = '\u03D6',
  mD = '\u210F',
  bD = '\u210E',
  vD = '\u210F',
  _D = '\u2A23',
  xD = '\u229E',
  kD = '\u2A22',
  yD = '+',
  wD = '\u2214',
  CD = '\u2A25',
  AD = '\u2A72',
  ED = '\xB1',
  DD = '\xB1',
  qD = '\u2A26',
  SD = '\u2A27',
  TD = '\xB1',
  RD = '\u210C',
  LD = '\u2A15',
  FD = '\u{1D561}',
  MD = '\u2119',
  ID = '\xA3',
  zD = '\u2AB7',
  PD = '\u2ABB',
  BD = '\u227A',
  ND = '\u227C',
  OD = '\u2AB7',
  HD = '\u227A',
  UD = '\u227C',
  jD = '\u227A',
  VD = '\u2AAF',
  $D = '\u227C',
  XD = '\u227E',
  YD = '\u2AAF',
  WD = '\u2AB9',
  GD = '\u2AB5',
  ZD = '\u22E8',
  JD = '\u2AAF',
  KD = '\u2AB3',
  QD = '\u227E',
  tq = '\u2032',
  eq = '\u2033',
  nq = '\u2119',
  rq = '\u2AB9',
  oq = '\u2AB5',
  sq = '\u22E8',
  cq = '\u220F',
  iq = '\u220F',
  lq = '\u232E',
  aq = '\u2312',
  uq = '\u2313',
  fq = '\u221D',
  pq = '\u221D',
  hq = '\u2237',
  dq = '\u221D',
  gq = '\u227E',
  mq = '\u22B0',
  bq = '\u{1D4AB}',
  vq = '\u{1D4C5}',
  _q = '\u03A8',
  xq = '\u03C8',
  kq = '\u2008',
  yq = '\u{1D514}',
  wq = '\u{1D52E}',
  Cq = '\u2A0C',
  Aq = '\u{1D562}',
  Eq = '\u211A',
  Dq = '\u2057',
  qq = '\u{1D4AC}',
  Sq = '\u{1D4C6}',
  Tq = '\u210D',
  Rq = '\u2A16',
  Lq = '?',
  Fq = '\u225F',
  Mq = '"',
  Iq = '"',
  zq = '\u21DB',
  Pq = '\u223D\u0331',
  Bq = '\u0154',
  Nq = '\u0155',
  Oq = '\u221A',
  Hq = '\u29B3',
  Uq = '\u27E9',
  jq = '\u27EB',
  Vq = '\u2992',
  $q = '\u29A5',
  Xq = '\u27E9',
  Yq = '\xBB',
  Wq = '\u2975',
  Gq = '\u21E5',
  Zq = '\u2920',
  Jq = '\u2933',
  Kq = '\u2192',
  Qq = '\u21A0',
  tS = '\u21D2',
  eS = '\u291E',
  nS = '\u21AA',
  rS = '\u21AC',
  oS = '\u2945',
  sS = '\u2974',
  cS = '\u2916',
  iS = '\u21A3',
  lS = '\u219D',
  aS = '\u291A',
  uS = '\u291C',
  fS = '\u2236',
  pS = '\u211A',
  hS = '\u290D',
  dS = '\u290F',
  gS = '\u2910',
  mS = '\u2773',
  bS = '}',
  vS = ']',
  _S = '\u298C',
  xS = '\u298E',
  kS = '\u2990',
  yS = '\u0158',
  wS = '\u0159',
  CS = '\u0156',
  AS = '\u0157',
  ES = '\u2309',
  DS = '}',
  qS = '\u0420',
  SS = '\u0440',
  TS = '\u2937',
  RS = '\u2969',
  LS = '\u201D',
  FS = '\u201D',
  MS = '\u21B3',
  IS = '\u211C',
  zS = '\u211B',
  PS = '\u211C',
  BS = '\u211D',
  NS = '\u211C',
  OS = '\u25AD',
  HS = '\xAE',
  US = '\xAE',
  jS = '\u220B',
  VS = '\u21CB',
  $S = '\u296F',
  XS = '\u297D',
  YS = '\u230B',
  WS = '\u{1D52F}',
  GS = '\u211C',
  ZS = '\u2964',
  JS = '\u21C1',
  KS = '\u21C0',
  QS = '\u296C',
  tT = '\u03A1',
  eT = '\u03C1',
  nT = '\u03F1',
  rT = '\u27E9',
  oT = '\u21E5',
  sT = '\u2192',
  cT = '\u2192',
  iT = '\u21D2',
  lT = '\u21C4',
  aT = '\u21A3',
  uT = '\u2309',
  fT = '\u27E7',
  pT = '\u295D',
  hT = '\u2955',
  dT = '\u21C2',
  gT = '\u230B',
  mT = '\u21C1',
  bT = '\u21C0',
  vT = '\u21C4',
  _T = '\u21CC',
  xT = '\u21C9',
  kT = '\u219D',
  yT = '\u21A6',
  wT = '\u22A2',
  CT = '\u295B',
  AT = '\u22CC',
  ET = '\u29D0',
  DT = '\u22B3',
  qT = '\u22B5',
  ST = '\u294F',
  TT = '\u295C',
  RT = '\u2954',
  LT = '\u21BE',
  FT = '\u2953',
  MT = '\u21C0',
  IT = '\u02DA',
  zT = '\u2253',
  PT = '\u21C4',
  BT = '\u21CC',
  NT = '\u200F',
  OT = '\u23B1',
  HT = '\u23B1',
  UT = '\u2AEE',
  jT = '\u27ED',
  VT = '\u21FE',
  $T = '\u27E7',
  XT = '\u2986',
  YT = '\u{1D563}',
  WT = '\u211D',
  GT = '\u2A2E',
  ZT = '\u2A35',
  JT = '\u2970',
  KT = ')',
  QT = '\u2994',
  tR = '\u2A12',
  eR = '\u21C9',
  nR = '\u21DB',
  rR = '\u203A',
  oR = '\u{1D4C7}',
  sR = '\u211B',
  cR = '\u21B1',
  iR = '\u21B1',
  lR = ']',
  aR = '\u2019',
  uR = '\u2019',
  fR = '\u22CC',
  pR = '\u22CA',
  hR = '\u25B9',
  dR = '\u22B5',
  gR = '\u25B8',
  mR = '\u29CE',
  bR = '\u29F4',
  vR = '\u2968',
  _R = '\u211E',
  xR = '\u015A',
  kR = '\u015B',
  yR = '\u201A',
  wR = '\u2AB8',
  CR = '\u0160',
  AR = '\u0161',
  ER = '\u2ABC',
  DR = '\u227B',
  qR = '\u227D',
  SR = '\u2AB0',
  TR = '\u2AB4',
  RR = '\u015E',
  LR = '\u015F',
  FR = '\u015C',
  MR = '\u015D',
  IR = '\u2ABA',
  zR = '\u2AB6',
  PR = '\u22E9',
  BR = '\u2A13',
  NR = '\u227F',
  OR = '\u0421',
  HR = '\u0441',
  UR = '\u22A1',
  jR = '\u22C5',
  VR = '\u2A66',
  $R = '\u2925',
  XR = '\u2198',
  YR = '\u21D8',
  WR = '\u2198',
  GR = '\xA7',
  ZR = ';',
  JR = '\u2929',
  KR = '\u2216',
  QR = '\u2216',
  tL = '\u2736',
  eL = '\u{1D516}',
  nL = '\u{1D530}',
  rL = '\u2322',
  oL = '\u266F',
  sL = '\u0429',
  cL = '\u0449',
  iL = '\u0428',
  lL = '\u0448',
  aL = '\u2193',
  uL = '\u2190',
  fL = '\u2223',
  pL = '\u2225',
  hL = '\u2192',
  dL = '\u2191',
  gL = '\xAD',
  mL = '\u03A3',
  bL = '\u03C3',
  vL = '\u03C2',
  _L = '\u03C2',
  xL = '\u223C',
  kL = '\u2A6A',
  yL = '\u2243',
  wL = '\u2243',
  CL = '\u2A9E',
  AL = '\u2AA0',
  EL = '\u2A9D',
  DL = '\u2A9F',
  qL = '\u2246',
  SL = '\u2A24',
  TL = '\u2972',
  RL = '\u2190',
  LL = '\u2218',
  FL = '\u2216',
  ML = '\u2A33',
  IL = '\u29E4',
  zL = '\u2223',
  PL = '\u2323',
  BL = '\u2AAA',
  NL = '\u2AAC',
  OL = '\u2AAC\uFE00',
  HL = '\u042C',
  UL = '\u044C',
  jL = '\u233F',
  VL = '\u29C4',
  $L = '/',
  XL = '\u{1D54A}',
  YL = '\u{1D564}',
  WL = '\u2660',
  GL = '\u2660',
  ZL = '\u2225',
  JL = '\u2293',
  KL = '\u2293\uFE00',
  QL = '\u2294',
  t2 = '\u2294\uFE00',
  e2 = '\u221A',
  n2 = '\u228F',
  r2 = '\u2291',
  o2 = '\u228F',
  s2 = '\u2291',
  c2 = '\u2290',
  i2 = '\u2292',
  l2 = '\u2290',
  a2 = '\u2292',
  u2 = '\u25A1',
  f2 = '\u25A1',
  p2 = '\u2293',
  h2 = '\u228F',
  d2 = '\u2291',
  g2 = '\u2290',
  m2 = '\u2292',
  b2 = '\u2294',
  v2 = '\u25AA',
  _2 = '\u25A1',
  x2 = '\u25AA',
  k2 = '\u2192',
  y2 = '\u{1D4AE}',
  w2 = '\u{1D4C8}',
  C2 = '\u2216',
  A2 = '\u2323',
  E2 = '\u22C6',
  D2 = '\u22C6',
  q2 = '\u2606',
  S2 = '\u2605',
  T2 = '\u03F5',
  R2 = '\u03D5',
  L2 = '\xAF',
  F2 = '\u2282',
  M2 = '\u22D0',
  I2 = '\u2ABD',
  z2 = '\u2AC5',
  P2 = '\u2286',
  B2 = '\u2AC3',
  N2 = '\u2AC1',
  O2 = '\u2ACB',
  H2 = '\u228A',
  U2 = '\u2ABF',
  j2 = '\u2979',
  V2 = '\u2282',
  $2 = '\u22D0',
  X2 = '\u2286',
  Y2 = '\u2AC5',
  W2 = '\u2286',
  G2 = '\u228A',
  Z2 = '\u2ACB',
  J2 = '\u2AC7',
  K2 = '\u2AD5',
  Q2 = '\u2AD3',
  tF = '\u2AB8',
  eF = '\u227B',
  nF = '\u227D',
  rF = '\u227B',
  oF = '\u2AB0',
  sF = '\u227D',
  cF = '\u227F',
  iF = '\u2AB0',
  lF = '\u2ABA',
  aF = '\u2AB6',
  uF = '\u22E9',
  fF = '\u227F',
  pF = '\u220B',
  hF = '\u2211',
  dF = '\u2211',
  gF = '\u266A',
  mF = '\xB9',
  bF = '\xB2',
  vF = '\xB3',
  _F = '\u2283',
  xF = '\u22D1',
  kF = '\u2ABE',
  yF = '\u2AD8',
  wF = '\u2AC6',
  CF = '\u2287',
  AF = '\u2AC4',
  EF = '\u2283',
  DF = '\u2287',
  qF = '\u27C9',
  SF = '\u2AD7',
  TF = '\u297B',
  RF = '\u2AC2',
  LF = '\u2ACC',
  FF = '\u228B',
  MF = '\u2AC0',
  IF = '\u2283',
  zF = '\u22D1',
  PF = '\u2287',
  BF = '\u2AC6',
  NF = '\u228B',
  OF = '\u2ACC',
  HF = '\u2AC8',
  UF = '\u2AD4',
  jF = '\u2AD6',
  VF = '\u2926',
  $F = '\u2199',
  XF = '\u21D9',
  YF = '\u2199',
  WF = '\u292A',
  GF = '\xDF',
  ZF = '	',
  JF = '\u2316',
  KF = '\u03A4',
  QF = '\u03C4',
  tM = '\u23B4',
  eM = '\u0164',
  nM = '\u0165',
  rM = '\u0162',
  oM = '\u0163',
  sM = '\u0422',
  cM = '\u0442',
  iM = '\u20DB',
  lM = '\u2315',
  aM = '\u{1D517}',
  uM = '\u{1D531}',
  fM = '\u2234',
  pM = '\u2234',
  hM = '\u2234',
  dM = '\u0398',
  gM = '\u03B8',
  mM = '\u03D1',
  bM = '\u03D1',
  vM = '\u2248',
  _M = '\u223C',
  xM = '\u205F\u200A',
  kM = '\u2009',
  yM = '\u2009',
  wM = '\u2248',
  CM = '\u223C',
  AM = '\xDE',
  EM = '\xFE',
  DM = '\u02DC',
  qM = '\u223C',
  SM = '\u2243',
  TM = '\u2245',
  RM = '\u2248',
  LM = '\u2A31',
  FM = '\u22A0',
  MM = '\xD7',
  IM = '\u2A30',
  zM = '\u222D',
  PM = '\u2928',
  BM = '\u2336',
  NM = '\u2AF1',
  OM = '\u22A4',
  HM = '\u{1D54B}',
  UM = '\u{1D565}',
  jM = '\u2ADA',
  VM = '\u2929',
  $M = '\u2034',
  XM = '\u2122',
  YM = '\u2122',
  WM = '\u25B5',
  GM = '\u25BF',
  ZM = '\u25C3',
  JM = '\u22B4',
  KM = '\u225C',
  QM = '\u25B9',
  tI = '\u22B5',
  eI = '\u25EC',
  nI = '\u225C',
  rI = '\u2A3A',
  oI = '\u20DB',
  sI = '\u2A39',
  cI = '\u29CD',
  iI = '\u2A3B',
  lI = '\u23E2',
  aI = '\u{1D4AF}',
  uI = '\u{1D4C9}',
  fI = '\u0426',
  pI = '\u0446',
  hI = '\u040B',
  dI = '\u045B',
  gI = '\u0166',
  mI = '\u0167',
  bI = '\u226C',
  vI = '\u219E',
  _I = '\u21A0',
  xI = '\xDA',
  kI = '\xFA',
  yI = '\u2191',
  wI = '\u219F',
  CI = '\u21D1',
  AI = '\u2949',
  EI = '\u040E',
  DI = '\u045E',
  qI = '\u016C',
  SI = '\u016D',
  TI = '\xDB',
  RI = '\xFB',
  LI = '\u0423',
  FI = '\u0443',
  MI = '\u21C5',
  II = '\u0170',
  zI = '\u0171',
  PI = '\u296E',
  BI = '\u297E',
  NI = '\u{1D518}',
  OI = '\u{1D532}',
  HI = '\xD9',
  UI = '\xF9',
  jI = '\u2963',
  VI = '\u21BF',
  $I = '\u21BE',
  XI = '\u2580',
  YI = '\u231C',
  WI = '\u231C',
  GI = '\u230F',
  ZI = '\u25F8',
  JI = '\u016A',
  KI = '\u016B',
  QI = '\xA8',
  tz = '_',
  ez = '\u23DF',
  nz = '\u23B5',
  rz = '\u23DD',
  oz = '\u22C3',
  sz = '\u228E',
  cz = '\u0172',
  iz = '\u0173',
  lz = '\u{1D54C}',
  az = '\u{1D566}',
  uz = '\u2912',
  fz = '\u2191',
  pz = '\u2191',
  hz = '\u21D1',
  dz = '\u21C5',
  gz = '\u2195',
  mz = '\u2195',
  bz = '\u21D5',
  vz = '\u296E',
  _z = '\u21BF',
  xz = '\u21BE',
  kz = '\u228E',
  yz = '\u2196',
  wz = '\u2197',
  Cz = '\u03C5',
  Az = '\u03D2',
  Ez = '\u03D2',
  Dz = '\u03A5',
  qz = '\u03C5',
  Sz = '\u21A5',
  Tz = '\u22A5',
  Rz = '\u21C8',
  Lz = '\u231D',
  Fz = '\u231D',
  Mz = '\u230E',
  Iz = '\u016E',
  zz = '\u016F',
  Pz = '\u25F9',
  Bz = '\u{1D4B0}',
  Nz = '\u{1D4CA}',
  Oz = '\u22F0',
  Hz = '\u0168',
  Uz = '\u0169',
  jz = '\u25B5',
  Vz = '\u25B4',
  $z = '\u21C8',
  Xz = '\xDC',
  Yz = '\xFC',
  Wz = '\u29A7',
  Gz = '\u299C',
  Zz = '\u03F5',
  Jz = '\u03F0',
  Kz = '\u2205',
  Qz = '\u03D5',
  tP = '\u03D6',
  eP = '\u221D',
  nP = '\u2195',
  rP = '\u21D5',
  oP = '\u03F1',
  sP = '\u03C2',
  cP = '\u228A\uFE00',
  iP = '\u2ACB\uFE00',
  lP = '\u228B\uFE00',
  aP = '\u2ACC\uFE00',
  uP = '\u03D1',
  fP = '\u22B2',
  pP = '\u22B3',
  hP = '\u2AE8',
  dP = '\u2AEB',
  gP = '\u2AE9',
  mP = '\u0412',
  bP = '\u0432',
  vP = '\u22A2',
  _P = '\u22A8',
  xP = '\u22A9',
  kP = '\u22AB',
  yP = '\u2AE6',
  wP = '\u22BB',
  CP = '\u2228',
  AP = '\u22C1',
  EP = '\u225A',
  DP = '\u22EE',
  qP = '|',
  SP = '\u2016',
  TP = '|',
  RP = '\u2016',
  LP = '\u2223',
  FP = '|',
  MP = '\u2758',
  IP = '\u2240',
  zP = '\u200A',
  PP = '\u{1D519}',
  BP = '\u{1D533}',
  NP = '\u22B2',
  OP = '\u2282\u20D2',
  HP = '\u2283\u20D2',
  UP = '\u{1D54D}',
  jP = '\u{1D567}',
  VP = '\u221D',
  $P = '\u22B3',
  XP = '\u{1D4B1}',
  YP = '\u{1D4CB}',
  WP = '\u2ACB\uFE00',
  GP = '\u228A\uFE00',
  ZP = '\u2ACC\uFE00',
  JP = '\u228B\uFE00',
  KP = '\u22AA',
  QP = '\u299A',
  tB = '\u0174',
  eB = '\u0175',
  nB = '\u2A5F',
  rB = '\u2227',
  oB = '\u22C0',
  sB = '\u2259',
  cB = '\u2118',
  iB = '\u{1D51A}',
  lB = '\u{1D534}',
  aB = '\u{1D54E}',
  uB = '\u{1D568}',
  fB = '\u2118',
  pB = '\u2240',
  hB = '\u2240',
  dB = '\u{1D4B2}',
  gB = '\u{1D4CC}',
  mB = '\u22C2',
  bB = '\u25EF',
  vB = '\u22C3',
  _B = '\u25BD',
  xB = '\u{1D51B}',
  kB = '\u{1D535}',
  yB = '\u27F7',
  wB = '\u27FA',
  CB = '\u039E',
  AB = '\u03BE',
  EB = '\u27F5',
  DB = '\u27F8',
  qB = '\u27FC',
  SB = '\u22FB',
  TB = '\u2A00',
  RB = '\u{1D54F}',
  LB = '\u{1D569}',
  FB = '\u2A01',
  MB = '\u2A02',
  IB = '\u27F6',
  zB = '\u27F9',
  PB = '\u{1D4B3}',
  BB = '\u{1D4CD}',
  NB = '\u2A06',
  OB = '\u2A04',
  HB = '\u25B3',
  UB = '\u22C1',
  jB = '\u22C0',
  VB = '\xDD',
  $B = '\xFD',
  XB = '\u042F',
  YB = '\u044F',
  WB = '\u0176',
  GB = '\u0177',
  ZB = '\u042B',
  JB = '\u044B',
  KB = '\xA5',
  QB = '\u{1D51C}',
  tN = '\u{1D536}',
  eN = '\u0407',
  nN = '\u0457',
  rN = '\u{1D550}',
  oN = '\u{1D56A}',
  sN = '\u{1D4B4}',
  cN = '\u{1D4CE}',
  iN = '\u042E',
  lN = '\u044E',
  aN = '\xFF',
  uN = '\u0178',
  fN = '\u0179',
  pN = '\u017A',
  hN = '\u017D',
  dN = '\u017E',
  gN = '\u0417',
  mN = '\u0437',
  bN = '\u017B',
  vN = '\u017C',
  _N = '\u2128',
  xN = '\u200B',
  kN = '\u0396',
  yN = '\u03B6',
  wN = '\u{1D537}',
  CN = '\u2128',
  AN = '\u0416',
  EN = '\u0436',
  DN = '\u21DD',
  qN = '\u{1D56B}',
  SN = '\u2124',
  TN = '\u{1D4B5}',
  RN = '\u{1D4CF}',
  LN = '\u200D',
  FN = '\u200C',
  MN = {
    Aacute: gr,
    aacute: mr,
    Abreve: br,
    abreve: vr,
    ac: _r,
    acd: xr,
    acE: kr,
    Acirc: yr,
    acirc: wr,
    acute: Cr,
    Acy: Ar,
    acy: Er,
    AElig: Dr,
    aelig: qr,
    af: Sr,
    Afr: Tr,
    afr: Rr,
    Agrave: Lr,
    agrave: Fr,
    alefsym: Mr,
    aleph: Ir,
    Alpha: zr,
    alpha: Pr,
    Amacr: Br,
    amacr: Nr,
    amalg: Or,
    amp: Hr,
    AMP: Ur,
    andand: jr,
    And: Vr,
    and: $r,
    andd: Xr,
    andslope: Yr,
    andv: Wr,
    ang: Gr,
    ange: Zr,
    angle: Jr,
    angmsdaa: Kr,
    angmsdab: Qr,
    angmsdac: to,
    angmsdad: eo,
    angmsdae: no,
    angmsdaf: ro,
    angmsdag: oo,
    angmsdah: so,
    angmsd: co,
    angrt: io,
    angrtvb: lo,
    angrtvbd: ao,
    angsph: uo,
    angst: fo,
    angzarr: po,
    Aogon: ho,
    aogon: go,
    Aopf: mo,
    aopf: bo,
    apacir: vo,
    ap: _o,
    apE: xo,
    ape: ko,
    apid: yo,
    apos: wo,
    ApplyFunction: Co,
    approx: Ao,
    approxeq: Eo,
    Aring: Do,
    aring: qo,
    Ascr: So,
    ascr: To,
    Assign: Ro,
    ast: Lo,
    asymp: Fo,
    asympeq: Mo,
    Atilde: Io,
    atilde: zo,
    Auml: Po,
    auml: Bo,
    awconint: No,
    awint: Oo,
    backcong: Ho,
    backepsilon: Uo,
    backprime: jo,
    backsim: Vo,
    backsimeq: $o,
    Backslash: Xo,
    Barv: Yo,
    barvee: Wo,
    barwed: Go,
    Barwed: Zo,
    barwedge: Jo,
    bbrk: Ko,
    bbrktbrk: Qo,
    bcong: ts,
    Bcy: es,
    bcy: ns,
    bdquo: rs,
    becaus: os,
    because: ss,
    Because: cs,
    bemptyv: is,
    bepsi: ls,
    bernou: as,
    Bernoullis: us,
    Beta: fs,
    beta: ps,
    beth: hs,
    between: ds,
    Bfr: gs,
    bfr: ms,
    bigcap: bs,
    bigcirc: vs,
    bigcup: _s,
    bigodot: xs,
    bigoplus: ks,
    bigotimes: ys,
    bigsqcup: ws,
    bigstar: Cs,
    bigtriangledown: As,
    bigtriangleup: Es,
    biguplus: Ds,
    bigvee: qs,
    bigwedge: Ss,
    bkarow: Ts,
    blacklozenge: Rs,
    blacksquare: Ls,
    blacktriangle: Fs,
    blacktriangledown: Ms,
    blacktriangleleft: Is,
    blacktriangleright: zs,
    blank: Ps,
    blk12: Bs,
    blk14: Ns,
    blk34: Os,
    block: Hs,
    bne: Us,
    bnequiv: js,
    bNot: Vs,
    bnot: $s,
    Bopf: Xs,
    bopf: Ys,
    bot: Ws,
    bottom: Gs,
    bowtie: Zs,
    boxbox: Js,
    boxdl: Ks,
    boxdL: Qs,
    boxDl: tc,
    boxDL: ec,
    boxdr: nc,
    boxdR: rc,
    boxDr: oc,
    boxDR: sc,
    boxh: cc,
    boxH: ic,
    boxhd: lc,
    boxHd: ac,
    boxhD: uc,
    boxHD: fc,
    boxhu: pc,
    boxHu: hc,
    boxhU: dc,
    boxHU: gc,
    boxminus: mc,
    boxplus: bc,
    boxtimes: vc,
    boxul: _c,
    boxuL: xc,
    boxUl: kc,
    boxUL: yc,
    boxur: wc,
    boxuR: Cc,
    boxUr: Ac,
    boxUR: Ec,
    boxv: Dc,
    boxV: qc,
    boxvh: Sc,
    boxvH: Tc,
    boxVh: Rc,
    boxVH: Lc,
    boxvl: Fc,
    boxvL: Mc,
    boxVl: Ic,
    boxVL: zc,
    boxvr: Pc,
    boxvR: Bc,
    boxVr: Nc,
    boxVR: Oc,
    bprime: Hc,
    breve: Uc,
    Breve: jc,
    brvbar: Vc,
    bscr: $c,
    Bscr: Xc,
    bsemi: Yc,
    bsim: Wc,
    bsime: Gc,
    bsolb: Zc,
    bsol: Jc,
    bsolhsub: Kc,
    bull: Qc,
    bullet: ti,
    bump: ei,
    bumpE: ni,
    bumpe: ri,
    Bumpeq: oi,
    bumpeq: si,
    Cacute: ci,
    cacute: ii,
    capand: li,
    capbrcup: ai,
    capcap: ui,
    cap: fi,
    Cap: pi,
    capcup: hi,
    capdot: di,
    CapitalDifferentialD: gi,
    caps: mi,
    caret: bi,
    caron: vi,
    Cayleys: _i,
    ccaps: xi,
    Ccaron: ki,
    ccaron: yi,
    Ccedil: wi,
    ccedil: Ci,
    Ccirc: Ai,
    ccirc: Ei,
    Cconint: Di,
    ccups: qi,
    ccupssm: Si,
    Cdot: Ti,
    cdot: Ri,
    cedil: Li,
    Cedilla: Fi,
    cemptyv: Mi,
    cent: Ii,
    centerdot: zi,
    CenterDot: Pi,
    cfr: Bi,
    Cfr: Ni,
    CHcy: Oi,
    chcy: Hi,
    check: Ui,
    checkmark: ji,
    Chi: Vi,
    chi: $i,
    circ: Xi,
    circeq: Yi,
    circlearrowleft: Wi,
    circlearrowright: Gi,
    circledast: Zi,
    circledcirc: Ji,
    circleddash: Ki,
    CircleDot: Qi,
    circledR: tl,
    circledS: el,
    CircleMinus: nl,
    CirclePlus: rl,
    CircleTimes: ol,
    cir: sl,
    cirE: cl,
    cire: il,
    cirfnint: ll,
    cirmid: al,
    cirscir: ul,
    ClockwiseContourIntegral: fl,
    CloseCurlyDoubleQuote: pl,
    CloseCurlyQuote: hl,
    clubs: dl,
    clubsuit: gl,
    colon: ml,
    Colon: bl,
    Colone: vl,
    colone: _l,
    coloneq: xl,
    comma: kl,
    commat: yl,
    comp: wl,
    compfn: Cl,
    complement: Al,
    complexes: El,
    cong: Dl,
    congdot: ql,
    Congruent: Sl,
    conint: Tl,
    Conint: Rl,
    ContourIntegral: Ll,
    copf: Fl,
    Copf: Ml,
    coprod: Il,
    Coproduct: zl,
    copy: Pl,
    COPY: Bl,
    copysr: Nl,
    CounterClockwiseContourIntegral: Ol,
    crarr: Hl,
    cross: Ul,
    Cross: jl,
    Cscr: Vl,
    cscr: $l,
    csub: Xl,
    csube: Yl,
    csup: Wl,
    csupe: Gl,
    ctdot: Zl,
    cudarrl: Jl,
    cudarrr: Kl,
    cuepr: Ql,
    cuesc: ta,
    cularr: ea,
    cularrp: na,
    cupbrcap: ra,
    cupcap: oa,
    CupCap: sa,
    cup: ca,
    Cup: ia,
    cupcup: la,
    cupdot: aa,
    cupor: ua,
    cups: fa,
    curarr: pa,
    curarrm: ha,
    curlyeqprec: da,
    curlyeqsucc: ga,
    curlyvee: ma,
    curlywedge: ba,
    curren: va,
    curvearrowleft: _a,
    curvearrowright: xa,
    cuvee: ka,
    cuwed: ya,
    cwconint: wa,
    cwint: Ca,
    cylcty: Aa,
    dagger: Ea,
    Dagger: Da,
    daleth: qa,
    darr: Sa,
    Darr: Ta,
    dArr: Ra,
    dash: La,
    Dashv: Fa,
    dashv: Ma,
    dbkarow: Ia,
    dblac: za,
    Dcaron: Pa,
    dcaron: Ba,
    Dcy: Na,
    dcy: Oa,
    ddagger: Ha,
    ddarr: Ua,
    DD: ja,
    dd: Va,
    DDotrahd: $a,
    ddotseq: Xa,
    deg: Ya,
    Del: Wa,
    Delta: Ga,
    delta: Za,
    demptyv: Ja,
    dfisht: Ka,
    Dfr: Qa,
    dfr: tu,
    dHar: eu,
    dharl: nu,
    dharr: ru,
    DiacriticalAcute: ou,
    DiacriticalDot: su,
    DiacriticalDoubleAcute: cu,
    DiacriticalGrave: iu,
    DiacriticalTilde: lu,
    diam: au,
    diamond: uu,
    Diamond: fu,
    diamondsuit: pu,
    diams: hu,
    die: du,
    DifferentialD: gu,
    digamma: mu,
    disin: bu,
    div: vu,
    divide: _u,
    divideontimes: xu,
    divonx: ku,
    DJcy: yu,
    djcy: wu,
    dlcorn: Cu,
    dlcrop: Au,
    dollar: Eu,
    Dopf: Du,
    dopf: qu,
    Dot: Su,
    dot: Tu,
    DotDot: Ru,
    doteq: Lu,
    doteqdot: Fu,
    DotEqual: Mu,
    dotminus: Iu,
    dotplus: zu,
    dotsquare: Pu,
    doublebarwedge: Bu,
    DoubleContourIntegral: Nu,
    DoubleDot: Ou,
    DoubleDownArrow: Hu,
    DoubleLeftArrow: Uu,
    DoubleLeftRightArrow: ju,
    DoubleLeftTee: Vu,
    DoubleLongLeftArrow: $u,
    DoubleLongLeftRightArrow: Xu,
    DoubleLongRightArrow: Yu,
    DoubleRightArrow: Wu,
    DoubleRightTee: Gu,
    DoubleUpArrow: Zu,
    DoubleUpDownArrow: Ju,
    DoubleVerticalBar: Ku,
    DownArrowBar: Qu,
    downarrow: tf,
    DownArrow: ef,
    Downarrow: nf,
    DownArrowUpArrow: rf,
    DownBreve: of,
    downdownarrows: sf,
    downharpoonleft: cf,
    downharpoonright: lf,
    DownLeftRightVector: af,
    DownLeftTeeVector: uf,
    DownLeftVectorBar: ff,
    DownLeftVector: pf,
    DownRightTeeVector: hf,
    DownRightVectorBar: df,
    DownRightVector: gf,
    DownTeeArrow: mf,
    DownTee: bf,
    drbkarow: vf,
    drcorn: _f,
    drcrop: xf,
    Dscr: kf,
    dscr: yf,
    DScy: wf,
    dscy: Cf,
    dsol: Af,
    Dstrok: Ef,
    dstrok: Df,
    dtdot: qf,
    dtri: Sf,
    dtrif: Tf,
    duarr: Rf,
    duhar: Lf,
    dwangle: Ff,
    DZcy: Mf,
    dzcy: If,
    dzigrarr: zf,
    Eacute: Pf,
    eacute: Bf,
    easter: Nf,
    Ecaron: Of,
    ecaron: Hf,
    Ecirc: Uf,
    ecirc: jf,
    ecir: Vf,
    ecolon: $f,
    Ecy: Xf,
    ecy: Yf,
    eDDot: Wf,
    Edot: Gf,
    edot: Zf,
    eDot: Jf,
    ee: Kf,
    efDot: Qf,
    Efr: tp,
    efr: ep,
    eg: np,
    Egrave: rp,
    egrave: op,
    egs: sp,
    egsdot: cp,
    el: ip,
    Element: lp,
    elinters: ap,
    ell: up,
    els: fp,
    elsdot: pp,
    Emacr: hp,
    emacr: dp,
    empty: gp,
    emptyset: mp,
    EmptySmallSquare: bp,
    emptyv: vp,
    EmptyVerySmallSquare: _p,
    emsp13: xp,
    emsp14: kp,
    emsp: yp,
    ENG: wp,
    eng: Cp,
    ensp: Ap,
    Eogon: Ep,
    eogon: Dp,
    Eopf: qp,
    eopf: Sp,
    epar: Tp,
    eparsl: Rp,
    eplus: Lp,
    epsi: Fp,
    Epsilon: Mp,
    epsilon: Ip,
    epsiv: zp,
    eqcirc: Pp,
    eqcolon: Bp,
    eqsim: Np,
    eqslantgtr: Op,
    eqslantless: Hp,
    Equal: Up,
    equals: jp,
    EqualTilde: Vp,
    equest: $p,
    Equilibrium: Xp,
    equiv: Yp,
    equivDD: Wp,
    eqvparsl: Gp,
    erarr: Zp,
    erDot: Jp,
    escr: Kp,
    Escr: Qp,
    esdot: th,
    Esim: eh,
    esim: nh,
    Eta: rh,
    eta: oh,
    ETH: sh,
    eth: ch,
    Euml: ih,
    euml: lh,
    euro: ah,
    excl: uh,
    exist: fh,
    Exists: ph,
    expectation: hh,
    exponentiale: dh,
    ExponentialE: gh,
    fallingdotseq: mh,
    Fcy: bh,
    fcy: vh,
    female: _h,
    ffilig: xh,
    fflig: kh,
    ffllig: yh,
    Ffr: wh,
    ffr: Ch,
    filig: Ah,
    FilledSmallSquare: Eh,
    FilledVerySmallSquare: Dh,
    fjlig: qh,
    flat: Sh,
    fllig: Th,
    fltns: Rh,
    fnof: Lh,
    Fopf: Fh,
    fopf: Mh,
    forall: Ih,
    ForAll: zh,
    fork: Ph,
    forkv: Bh,
    Fouriertrf: Nh,
    fpartint: Oh,
    frac12: Hh,
    frac13: Uh,
    frac14: jh,
    frac15: Vh,
    frac16: $h,
    frac18: Xh,
    frac23: Yh,
    frac25: Wh,
    frac34: Gh,
    frac35: Zh,
    frac38: Jh,
    frac45: Kh,
    frac56: Qh,
    frac58: td,
    frac78: ed,
    frasl: nd,
    frown: rd,
    fscr: od,
    Fscr: sd,
    gacute: cd,
    Gamma: id,
    gamma: ld,
    Gammad: ad,
    gammad: ud,
    gap: fd,
    Gbreve: pd,
    gbreve: hd,
    Gcedil: dd,
    Gcirc: gd,
    gcirc: md,
    Gcy: bd,
    gcy: vd,
    Gdot: _d,
    gdot: xd,
    ge: kd,
    gE: yd,
    gEl: wd,
    gel: Cd,
    geq: Ad,
    geqq: Ed,
    geqslant: Dd,
    gescc: qd,
    ges: Sd,
    gesdot: Td,
    gesdoto: Rd,
    gesdotol: Ld,
    gesl: Fd,
    gesles: Md,
    Gfr: Id,
    gfr: zd,
    gg: Pd,
    Gg: Bd,
    ggg: Nd,
    gimel: Od,
    GJcy: Hd,
    gjcy: Ud,
    gla: jd,
    gl: Vd,
    glE: $d,
    glj: Xd,
    gnap: Yd,
    gnapprox: Wd,
    gne: Gd,
    gnE: Zd,
    gneq: Jd,
    gneqq: Kd,
    gnsim: Qd,
    Gopf: tg,
    gopf: eg,
    grave: ng,
    GreaterEqual: rg,
    GreaterEqualLess: og,
    GreaterFullEqual: sg,
    GreaterGreater: cg,
    GreaterLess: ig,
    GreaterSlantEqual: lg,
    GreaterTilde: ag,
    Gscr: ug,
    gscr: fg,
    gsim: pg,
    gsime: hg,
    gsiml: dg,
    gtcc: gg,
    gtcir: mg,
    gt: bg,
    GT: vg,
    Gt: _g,
    gtdot: xg,
    gtlPar: kg,
    gtquest: yg,
    gtrapprox: wg,
    gtrarr: Cg,
    gtrdot: Ag,
    gtreqless: Eg,
    gtreqqless: Dg,
    gtrless: qg,
    gtrsim: Sg,
    gvertneqq: Tg,
    gvnE: Rg,
    Hacek: Lg,
    hairsp: Fg,
    half: Mg,
    hamilt: Ig,
    HARDcy: zg,
    hardcy: Pg,
    harrcir: Bg,
    harr: Ng,
    hArr: Og,
    harrw: Hg,
    Hat: Ug,
    hbar: jg,
    Hcirc: Vg,
    hcirc: $g,
    hearts: Xg,
    heartsuit: Yg,
    hellip: Wg,
    hercon: Gg,
    hfr: Zg,
    Hfr: Jg,
    HilbertSpace: Kg,
    hksearow: Qg,
    hkswarow: tm,
    hoarr: em,
    homtht: nm,
    hookleftarrow: rm,
    hookrightarrow: om,
    hopf: sm,
    Hopf: cm,
    horbar: im,
    HorizontalLine: lm,
    hscr: am,
    Hscr: um,
    hslash: fm,
    Hstrok: pm,
    hstrok: hm,
    HumpDownHump: dm,
    HumpEqual: gm,
    hybull: mm,
    hyphen: bm,
    Iacute: vm,
    iacute: _m,
    ic: xm,
    Icirc: km,
    icirc: ym,
    Icy: wm,
    icy: Cm,
    Idot: Am,
    IEcy: Em,
    iecy: Dm,
    iexcl: qm,
    iff: Sm,
    ifr: Tm,
    Ifr: Rm,
    Igrave: Lm,
    igrave: Fm,
    ii: Mm,
    iiiint: Im,
    iiint: zm,
    iinfin: Pm,
    iiota: Bm,
    IJlig: Nm,
    ijlig: Om,
    Imacr: Hm,
    imacr: Um,
    image: jm,
    ImaginaryI: Vm,
    imagline: $m,
    imagpart: Xm,
    imath: Ym,
    Im: Wm,
    imof: Gm,
    imped: Zm,
    Implies: Jm,
    incare: Km,
    in: '\u2208',
    infin: Qm,
    infintie: tb,
    inodot: eb,
    intcal: nb,
    int: rb,
    Int: ob,
    integers: sb,
    Integral: cb,
    intercal: ib,
    Intersection: lb,
    intlarhk: ab,
    intprod: ub,
    InvisibleComma: fb,
    InvisibleTimes: pb,
    IOcy: hb,
    iocy: db,
    Iogon: gb,
    iogon: mb,
    Iopf: bb,
    iopf: vb,
    Iota: _b,
    iota: xb,
    iprod: kb,
    iquest: yb,
    iscr: wb,
    Iscr: Cb,
    isin: Ab,
    isindot: Eb,
    isinE: Db,
    isins: qb,
    isinsv: Sb,
    isinv: Tb,
    it: Rb,
    Itilde: Lb,
    itilde: Fb,
    Iukcy: Mb,
    iukcy: Ib,
    Iuml: zb,
    iuml: Pb,
    Jcirc: Bb,
    jcirc: Nb,
    Jcy: Ob,
    jcy: Hb,
    Jfr: Ub,
    jfr: jb,
    jmath: Vb,
    Jopf: $b,
    jopf: Xb,
    Jscr: Yb,
    jscr: Wb,
    Jsercy: Gb,
    jsercy: Zb,
    Jukcy: Jb,
    jukcy: Kb,
    Kappa: Qb,
    kappa: t0,
    kappav: e0,
    Kcedil: n0,
    kcedil: r0,
    Kcy: o0,
    kcy: s0,
    Kfr: c0,
    kfr: i0,
    kgreen: l0,
    KHcy: a0,
    khcy: u0,
    KJcy: f0,
    kjcy: p0,
    Kopf: h0,
    kopf: d0,
    Kscr: g0,
    kscr: m0,
    lAarr: b0,
    Lacute: v0,
    lacute: _0,
    laemptyv: x0,
    lagran: k0,
    Lambda: y0,
    lambda: w0,
    lang: C0,
    Lang: A0,
    langd: E0,
    langle: D0,
    lap: q0,
    Laplacetrf: S0,
    laquo: T0,
    larrb: R0,
    larrbfs: L0,
    larr: F0,
    Larr: M0,
    lArr: I0,
    larrfs: z0,
    larrhk: P0,
    larrlp: B0,
    larrpl: N0,
    larrsim: O0,
    larrtl: H0,
    latail: U0,
    lAtail: j0,
    lat: V0,
    late: $0,
    lates: X0,
    lbarr: Y0,
    lBarr: W0,
    lbbrk: G0,
    lbrace: Z0,
    lbrack: J0,
    lbrke: K0,
    lbrksld: Q0,
    lbrkslu: tv,
    Lcaron: ev,
    lcaron: nv,
    Lcedil: rv,
    lcedil: ov,
    lceil: sv,
    lcub: cv,
    Lcy: iv,
    lcy: lv,
    ldca: av,
    ldquo: uv,
    ldquor: fv,
    ldrdhar: pv,
    ldrushar: hv,
    ldsh: dv,
    le: gv,
    lE: mv,
    LeftAngleBracket: bv,
    LeftArrowBar: vv,
    leftarrow: _v,
    LeftArrow: xv,
    Leftarrow: kv,
    LeftArrowRightArrow: yv,
    leftarrowtail: wv,
    LeftCeiling: Cv,
    LeftDoubleBracket: Av,
    LeftDownTeeVector: Ev,
    LeftDownVectorBar: Dv,
    LeftDownVector: qv,
    LeftFloor: Sv,
    leftharpoondown: Tv,
    leftharpoonup: Rv,
    leftleftarrows: Lv,
    leftrightarrow: Fv,
    LeftRightArrow: Mv,
    Leftrightarrow: Iv,
    leftrightarrows: zv,
    leftrightharpoons: Pv,
    leftrightsquigarrow: Bv,
    LeftRightVector: Nv,
    LeftTeeArrow: Ov,
    LeftTee: Hv,
    LeftTeeVector: Uv,
    leftthreetimes: jv,
    LeftTriangleBar: Vv,
    LeftTriangle: $v,
    LeftTriangleEqual: Xv,
    LeftUpDownVector: Yv,
    LeftUpTeeVector: Wv,
    LeftUpVectorBar: Gv,
    LeftUpVector: Zv,
    LeftVectorBar: Jv,
    LeftVector: Kv,
    lEg: Qv,
    leg: t_,
    leq: e_,
    leqq: n_,
    leqslant: r_,
    lescc: o_,
    les: s_,
    lesdot: c_,
    lesdoto: i_,
    lesdotor: l_,
    lesg: a_,
    lesges: u_,
    lessapprox: f_,
    lessdot: p_,
    lesseqgtr: h_,
    lesseqqgtr: d_,
    LessEqualGreater: g_,
    LessFullEqual: m_,
    LessGreater: b_,
    lessgtr: v_,
    LessLess: __,
    lesssim: x_,
    LessSlantEqual: k_,
    LessTilde: y_,
    lfisht: w_,
    lfloor: C_,
    Lfr: A_,
    lfr: E_,
    lg: D_,
    lgE: q_,
    lHar: S_,
    lhard: T_,
    lharu: R_,
    lharul: L_,
    lhblk: F_,
    LJcy: M_,
    ljcy: I_,
    llarr: z_,
    ll: P_,
    Ll: B_,
    llcorner: N_,
    Lleftarrow: O_,
    llhard: H_,
    lltri: U_,
    Lmidot: j_,
    lmidot: V_,
    lmoustache: $_,
    lmoust: X_,
    lnap: Y_,
    lnapprox: W_,
    lne: G_,
    lnE: Z_,
    lneq: J_,
    lneqq: K_,
    lnsim: Q_,
    loang: tx,
    loarr: ex,
    lobrk: nx,
    longleftarrow: rx,
    LongLeftArrow: ox,
    Longleftarrow: sx,
    longleftrightarrow: cx,
    LongLeftRightArrow: ix,
    Longleftrightarrow: lx,
    longmapsto: ax,
    longrightarrow: ux,
    LongRightArrow: fx,
    Longrightarrow: px,
    looparrowleft: hx,
    looparrowright: dx,
    lopar: gx,
    Lopf: mx,
    lopf: bx,
    loplus: vx,
    lotimes: _x,
    lowast: xx,
    lowbar: kx,
    LowerLeftArrow: yx,
    LowerRightArrow: wx,
    loz: Cx,
    lozenge: Ax,
    lozf: Ex,
    lpar: Dx,
    lparlt: qx,
    lrarr: Sx,
    lrcorner: Tx,
    lrhar: Rx,
    lrhard: Lx,
    lrm: Fx,
    lrtri: Mx,
    lsaquo: Ix,
    lscr: zx,
    Lscr: Px,
    lsh: Bx,
    Lsh: Nx,
    lsim: Ox,
    lsime: Hx,
    lsimg: Ux,
    lsqb: jx,
    lsquo: Vx,
    lsquor: $x,
    Lstrok: Xx,
    lstrok: Yx,
    ltcc: Wx,
    ltcir: Gx,
    lt: Zx,
    LT: Jx,
    Lt: Kx,
    ltdot: Qx,
    lthree: tk,
    ltimes: ek,
    ltlarr: nk,
    ltquest: rk,
    ltri: ok,
    ltrie: sk,
    ltrif: ck,
    ltrPar: ik,
    lurdshar: lk,
    luruhar: ak,
    lvertneqq: uk,
    lvnE: fk,
    macr: pk,
    male: hk,
    malt: dk,
    maltese: gk,
    Map: '\u2905',
    map: mk,
    mapsto: bk,
    mapstodown: vk,
    mapstoleft: _k,
    mapstoup: xk,
    marker: kk,
    mcomma: yk,
    Mcy: wk,
    mcy: Ck,
    mdash: Ak,
    mDDot: Ek,
    measuredangle: Dk,
    MediumSpace: qk,
    Mellintrf: Sk,
    Mfr: Tk,
    mfr: Rk,
    mho: Lk,
    micro: Fk,
    midast: Mk,
    midcir: Ik,
    mid: zk,
    middot: Pk,
    minusb: Bk,
    minus: Nk,
    minusd: Ok,
    minusdu: Hk,
    MinusPlus: Uk,
    mlcp: jk,
    mldr: Vk,
    mnplus: $k,
    models: Xk,
    Mopf: Yk,
    mopf: Wk,
    mp: Gk,
    mscr: Zk,
    Mscr: Jk,
    mstpos: Kk,
    Mu: Qk,
    mu: ty,
    multimap: ey,
    mumap: ny,
    nabla: ry,
    Nacute: oy,
    nacute: sy,
    nang: cy,
    nap: iy,
    napE: ly,
    napid: ay,
    napos: uy,
    napprox: fy,
    natural: py,
    naturals: hy,
    natur: dy,
    nbsp: gy,
    nbump: my,
    nbumpe: by,
    ncap: vy,
    Ncaron: _y,
    ncaron: xy,
    Ncedil: ky,
    ncedil: yy,
    ncong: wy,
    ncongdot: Cy,
    ncup: Ay,
    Ncy: Ey,
    ncy: Dy,
    ndash: qy,
    nearhk: Sy,
    nearr: Ty,
    neArr: Ry,
    nearrow: Ly,
    ne: Fy,
    nedot: My,
    NegativeMediumSpace: Iy,
    NegativeThickSpace: zy,
    NegativeThinSpace: Py,
    NegativeVeryThinSpace: By,
    nequiv: Ny,
    nesear: Oy,
    nesim: Hy,
    NestedGreaterGreater: Uy,
    NestedLessLess: jy,
    NewLine: Vy,
    nexist: $y,
    nexists: Xy,
    Nfr: Yy,
    nfr: Wy,
    ngE: Gy,
    nge: Zy,
    ngeq: Jy,
    ngeqq: Ky,
    ngeqslant: Qy,
    nges: tw,
    nGg: ew,
    ngsim: nw,
    nGt: rw,
    ngt: ow,
    ngtr: sw,
    nGtv: cw,
    nharr: iw,
    nhArr: lw,
    nhpar: aw,
    ni: uw,
    nis: fw,
    nisd: pw,
    niv: hw,
    NJcy: dw,
    njcy: gw,
    nlarr: mw,
    nlArr: bw,
    nldr: vw,
    nlE: _w,
    nle: xw,
    nleftarrow: kw,
    nLeftarrow: yw,
    nleftrightarrow: ww,
    nLeftrightarrow: Cw,
    nleq: Aw,
    nleqq: Ew,
    nleqslant: Dw,
    nles: qw,
    nless: Sw,
    nLl: Tw,
    nlsim: Rw,
    nLt: Lw,
    nlt: Fw,
    nltri: Mw,
    nltrie: Iw,
    nLtv: zw,
    nmid: Pw,
    NoBreak: Bw,
    NonBreakingSpace: Nw,
    nopf: Ow,
    Nopf: Hw,
    Not: Uw,
    not: jw,
    NotCongruent: Vw,
    NotCupCap: $w,
    NotDoubleVerticalBar: Xw,
    NotElement: Yw,
    NotEqual: Ww,
    NotEqualTilde: Gw,
    NotExists: Zw,
    NotGreater: Jw,
    NotGreaterEqual: Kw,
    NotGreaterFullEqual: Qw,
    NotGreaterGreater: t1,
    NotGreaterLess: e1,
    NotGreaterSlantEqual: n1,
    NotGreaterTilde: r1,
    NotHumpDownHump: o1,
    NotHumpEqual: s1,
    notin: c1,
    notindot: i1,
    notinE: l1,
    notinva: a1,
    notinvb: u1,
    notinvc: f1,
    NotLeftTriangleBar: p1,
    NotLeftTriangle: h1,
    NotLeftTriangleEqual: d1,
    NotLess: g1,
    NotLessEqual: m1,
    NotLessGreater: b1,
    NotLessLess: v1,
    NotLessSlantEqual: _1,
    NotLessTilde: x1,
    NotNestedGreaterGreater: k1,
    NotNestedLessLess: y1,
    notni: w1,
    notniva: C1,
    notnivb: A1,
    notnivc: E1,
    NotPrecedes: D1,
    NotPrecedesEqual: q1,
    NotPrecedesSlantEqual: S1,
    NotReverseElement: T1,
    NotRightTriangleBar: R1,
    NotRightTriangle: L1,
    NotRightTriangleEqual: F1,
    NotSquareSubset: M1,
    NotSquareSubsetEqual: I1,
    NotSquareSuperset: z1,
    NotSquareSupersetEqual: P1,
    NotSubset: B1,
    NotSubsetEqual: N1,
    NotSucceeds: O1,
    NotSucceedsEqual: H1,
    NotSucceedsSlantEqual: U1,
    NotSucceedsTilde: j1,
    NotSuperset: V1,
    NotSupersetEqual: $1,
    NotTilde: X1,
    NotTildeEqual: Y1,
    NotTildeFullEqual: W1,
    NotTildeTilde: G1,
    NotVerticalBar: Z1,
    nparallel: J1,
    npar: K1,
    nparsl: Q1,
    npart: tC,
    npolint: eC,
    npr: nC,
    nprcue: rC,
    nprec: oC,
    npreceq: sC,
    npre: cC,
    nrarrc: iC,
    nrarr: lC,
    nrArr: aC,
    nrarrw: uC,
    nrightarrow: fC,
    nRightarrow: pC,
    nrtri: hC,
    nrtrie: dC,
    nsc: gC,
    nsccue: mC,
    nsce: bC,
    Nscr: vC,
    nscr: _C,
    nshortmid: xC,
    nshortparallel: kC,
    nsim: yC,
    nsime: wC,
    nsimeq: CC,
    nsmid: AC,
    nspar: EC,
    nsqsube: DC,
    nsqsupe: qC,
    nsub: SC,
    nsubE: TC,
    nsube: RC,
    nsubset: LC,
    nsubseteq: FC,
    nsubseteqq: MC,
    nsucc: IC,
    nsucceq: zC,
    nsup: PC,
    nsupE: BC,
    nsupe: NC,
    nsupset: OC,
    nsupseteq: HC,
    nsupseteqq: UC,
    ntgl: jC,
    Ntilde: VC,
    ntilde: $C,
    ntlg: XC,
    ntriangleleft: YC,
    ntrianglelefteq: WC,
    ntriangleright: GC,
    ntrianglerighteq: ZC,
    Nu: JC,
    nu: KC,
    num: QC,
    numero: tA,
    numsp: eA,
    nvap: nA,
    nvdash: rA,
    nvDash: oA,
    nVdash: sA,
    nVDash: cA,
    nvge: iA,
    nvgt: lA,
    nvHarr: aA,
    nvinfin: uA,
    nvlArr: fA,
    nvle: pA,
    nvlt: hA,
    nvltrie: dA,
    nvrArr: gA,
    nvrtrie: mA,
    nvsim: bA,
    nwarhk: vA,
    nwarr: _A,
    nwArr: xA,
    nwarrow: kA,
    nwnear: yA,
    Oacute: wA,
    oacute: CA,
    oast: AA,
    Ocirc: EA,
    ocirc: DA,
    ocir: qA,
    Ocy: SA,
    ocy: TA,
    odash: RA,
    Odblac: LA,
    odblac: FA,
    odiv: MA,
    odot: IA,
    odsold: zA,
    OElig: PA,
    oelig: BA,
    ofcir: NA,
    Ofr: OA,
    ofr: HA,
    ogon: UA,
    Ograve: jA,
    ograve: VA,
    ogt: $A,
    ohbar: XA,
    ohm: YA,
    oint: WA,
    olarr: GA,
    olcir: ZA,
    olcross: JA,
    oline: KA,
    olt: QA,
    Omacr: tE,
    omacr: eE,
    Omega: nE,
    omega: rE,
    Omicron: oE,
    omicron: sE,
    omid: cE,
    ominus: iE,
    Oopf: lE,
    oopf: aE,
    opar: uE,
    OpenCurlyDoubleQuote: fE,
    OpenCurlyQuote: pE,
    operp: hE,
    oplus: dE,
    orarr: gE,
    Or: mE,
    or: bE,
    ord: vE,
    order: _E,
    orderof: xE,
    ordf: kE,
    ordm: yE,
    origof: wE,
    oror: CE,
    orslope: AE,
    orv: EE,
    oS: DE,
    Oscr: qE,
    oscr: SE,
    Oslash: TE,
    oslash: RE,
    osol: LE,
    Otilde: FE,
    otilde: ME,
    otimesas: IE,
    Otimes: zE,
    otimes: PE,
    Ouml: BE,
    ouml: NE,
    ovbar: OE,
    OverBar: HE,
    OverBrace: UE,
    OverBracket: jE,
    OverParenthesis: VE,
    para: $E,
    parallel: XE,
    par: YE,
    parsim: WE,
    parsl: GE,
    part: ZE,
    PartialD: JE,
    Pcy: KE,
    pcy: QE,
    percnt: tD,
    period: eD,
    permil: nD,
    perp: rD,
    pertenk: oD,
    Pfr: sD,
    pfr: cD,
    Phi: iD,
    phi: lD,
    phiv: aD,
    phmmat: uD,
    phone: fD,
    Pi: pD,
    pi: hD,
    pitchfork: dD,
    piv: gD,
    planck: mD,
    planckh: bD,
    plankv: vD,
    plusacir: _D,
    plusb: xD,
    pluscir: kD,
    plus: yD,
    plusdo: wD,
    plusdu: CD,
    pluse: AD,
    PlusMinus: ED,
    plusmn: DD,
    plussim: qD,
    plustwo: SD,
    pm: TD,
    Poincareplane: RD,
    pointint: LD,
    popf: FD,
    Popf: MD,
    pound: ID,
    prap: zD,
    Pr: PD,
    pr: BD,
    prcue: ND,
    precapprox: OD,
    prec: HD,
    preccurlyeq: UD,
    Precedes: jD,
    PrecedesEqual: VD,
    PrecedesSlantEqual: $D,
    PrecedesTilde: XD,
    preceq: YD,
    precnapprox: WD,
    precneqq: GD,
    precnsim: ZD,
    pre: JD,
    prE: KD,
    precsim: QD,
    prime: tq,
    Prime: eq,
    primes: nq,
    prnap: rq,
    prnE: oq,
    prnsim: sq,
    prod: cq,
    Product: iq,
    profalar: lq,
    profline: aq,
    profsurf: uq,
    prop: fq,
    Proportional: pq,
    Proportion: hq,
    propto: dq,
    prsim: gq,
    prurel: mq,
    Pscr: bq,
    pscr: vq,
    Psi: _q,
    psi: xq,
    puncsp: kq,
    Qfr: yq,
    qfr: wq,
    qint: Cq,
    qopf: Aq,
    Qopf: Eq,
    qprime: Dq,
    Qscr: qq,
    qscr: Sq,
    quaternions: Tq,
    quatint: Rq,
    quest: Lq,
    questeq: Fq,
    quot: Mq,
    QUOT: Iq,
    rAarr: zq,
    race: Pq,
    Racute: Bq,
    racute: Nq,
    radic: Oq,
    raemptyv: Hq,
    rang: Uq,
    Rang: jq,
    rangd: Vq,
    range: $q,
    rangle: Xq,
    raquo: Yq,
    rarrap: Wq,
    rarrb: Gq,
    rarrbfs: Zq,
    rarrc: Jq,
    rarr: Kq,
    Rarr: Qq,
    rArr: tS,
    rarrfs: eS,
    rarrhk: nS,
    rarrlp: rS,
    rarrpl: oS,
    rarrsim: sS,
    Rarrtl: cS,
    rarrtl: iS,
    rarrw: lS,
    ratail: aS,
    rAtail: uS,
    ratio: fS,
    rationals: pS,
    rbarr: hS,
    rBarr: dS,
    RBarr: gS,
    rbbrk: mS,
    rbrace: bS,
    rbrack: vS,
    rbrke: _S,
    rbrksld: xS,
    rbrkslu: kS,
    Rcaron: yS,
    rcaron: wS,
    Rcedil: CS,
    rcedil: AS,
    rceil: ES,
    rcub: DS,
    Rcy: qS,
    rcy: SS,
    rdca: TS,
    rdldhar: RS,
    rdquo: LS,
    rdquor: FS,
    rdsh: MS,
    real: IS,
    realine: zS,
    realpart: PS,
    reals: BS,
    Re: NS,
    rect: OS,
    reg: HS,
    REG: US,
    ReverseElement: jS,
    ReverseEquilibrium: VS,
    ReverseUpEquilibrium: $S,
    rfisht: XS,
    rfloor: YS,
    rfr: WS,
    Rfr: GS,
    rHar: ZS,
    rhard: JS,
    rharu: KS,
    rharul: QS,
    Rho: tT,
    rho: eT,
    rhov: nT,
    RightAngleBracket: rT,
    RightArrowBar: oT,
    rightarrow: sT,
    RightArrow: cT,
    Rightarrow: iT,
    RightArrowLeftArrow: lT,
    rightarrowtail: aT,
    RightCeiling: uT,
    RightDoubleBracket: fT,
    RightDownTeeVector: pT,
    RightDownVectorBar: hT,
    RightDownVector: dT,
    RightFloor: gT,
    rightharpoondown: mT,
    rightharpoonup: bT,
    rightleftarrows: vT,
    rightleftharpoons: _T,
    rightrightarrows: xT,
    rightsquigarrow: kT,
    RightTeeArrow: yT,
    RightTee: wT,
    RightTeeVector: CT,
    rightthreetimes: AT,
    RightTriangleBar: ET,
    RightTriangle: DT,
    RightTriangleEqual: qT,
    RightUpDownVector: ST,
    RightUpTeeVector: TT,
    RightUpVectorBar: RT,
    RightUpVector: LT,
    RightVectorBar: FT,
    RightVector: MT,
    ring: IT,
    risingdotseq: zT,
    rlarr: PT,
    rlhar: BT,
    rlm: NT,
    rmoustache: OT,
    rmoust: HT,
    rnmid: UT,
    roang: jT,
    roarr: VT,
    robrk: $T,
    ropar: XT,
    ropf: YT,
    Ropf: WT,
    roplus: GT,
    rotimes: ZT,
    RoundImplies: JT,
    rpar: KT,
    rpargt: QT,
    rppolint: tR,
    rrarr: eR,
    Rrightarrow: nR,
    rsaquo: rR,
    rscr: oR,
    Rscr: sR,
    rsh: cR,
    Rsh: iR,
    rsqb: lR,
    rsquo: aR,
    rsquor: uR,
    rthree: fR,
    rtimes: pR,
    rtri: hR,
    rtrie: dR,
    rtrif: gR,
    rtriltri: mR,
    RuleDelayed: bR,
    ruluhar: vR,
    rx: _R,
    Sacute: xR,
    sacute: kR,
    sbquo: yR,
    scap: wR,
    Scaron: CR,
    scaron: AR,
    Sc: ER,
    sc: DR,
    sccue: qR,
    sce: SR,
    scE: TR,
    Scedil: RR,
    scedil: LR,
    Scirc: FR,
    scirc: MR,
    scnap: IR,
    scnE: zR,
    scnsim: PR,
    scpolint: BR,
    scsim: NR,
    Scy: OR,
    scy: HR,
    sdotb: UR,
    sdot: jR,
    sdote: VR,
    searhk: $R,
    searr: XR,
    seArr: YR,
    searrow: WR,
    sect: GR,
    semi: ZR,
    seswar: JR,
    setminus: KR,
    setmn: QR,
    sext: tL,
    Sfr: eL,
    sfr: nL,
    sfrown: rL,
    sharp: oL,
    SHCHcy: sL,
    shchcy: cL,
    SHcy: iL,
    shcy: lL,
    ShortDownArrow: aL,
    ShortLeftArrow: uL,
    shortmid: fL,
    shortparallel: pL,
    ShortRightArrow: hL,
    ShortUpArrow: dL,
    shy: gL,
    Sigma: mL,
    sigma: bL,
    sigmaf: vL,
    sigmav: _L,
    sim: xL,
    simdot: kL,
    sime: yL,
    simeq: wL,
    simg: CL,
    simgE: AL,
    siml: EL,
    simlE: DL,
    simne: qL,
    simplus: SL,
    simrarr: TL,
    slarr: RL,
    SmallCircle: LL,
    smallsetminus: FL,
    smashp: ML,
    smeparsl: IL,
    smid: zL,
    smile: PL,
    smt: BL,
    smte: NL,
    smtes: OL,
    SOFTcy: HL,
    softcy: UL,
    solbar: jL,
    solb: VL,
    sol: $L,
    Sopf: XL,
    sopf: YL,
    spades: WL,
    spadesuit: GL,
    spar: ZL,
    sqcap: JL,
    sqcaps: KL,
    sqcup: QL,
    sqcups: t2,
    Sqrt: e2,
    sqsub: n2,
    sqsube: r2,
    sqsubset: o2,
    sqsubseteq: s2,
    sqsup: c2,
    sqsupe: i2,
    sqsupset: l2,
    sqsupseteq: a2,
    square: u2,
    Square: f2,
    SquareIntersection: p2,
    SquareSubset: h2,
    SquareSubsetEqual: d2,
    SquareSuperset: g2,
    SquareSupersetEqual: m2,
    SquareUnion: b2,
    squarf: v2,
    squ: _2,
    squf: x2,
    srarr: k2,
    Sscr: y2,
    sscr: w2,
    ssetmn: C2,
    ssmile: A2,
    sstarf: E2,
    Star: D2,
    star: q2,
    starf: S2,
    straightepsilon: T2,
    straightphi: R2,
    strns: L2,
    sub: F2,
    Sub: M2,
    subdot: I2,
    subE: z2,
    sube: P2,
    subedot: B2,
    submult: N2,
    subnE: O2,
    subne: H2,
    subplus: U2,
    subrarr: j2,
    subset: V2,
    Subset: $2,
    subseteq: X2,
    subseteqq: Y2,
    SubsetEqual: W2,
    subsetneq: G2,
    subsetneqq: Z2,
    subsim: J2,
    subsub: K2,
    subsup: Q2,
    succapprox: tF,
    succ: eF,
    succcurlyeq: nF,
    Succeeds: rF,
    SucceedsEqual: oF,
    SucceedsSlantEqual: sF,
    SucceedsTilde: cF,
    succeq: iF,
    succnapprox: lF,
    succneqq: aF,
    succnsim: uF,
    succsim: fF,
    SuchThat: pF,
    sum: hF,
    Sum: dF,
    sung: gF,
    sup1: mF,
    sup2: bF,
    sup3: vF,
    sup: _F,
    Sup: xF,
    supdot: kF,
    supdsub: yF,
    supE: wF,
    supe: CF,
    supedot: AF,
    Superset: EF,
    SupersetEqual: DF,
    suphsol: qF,
    suphsub: SF,
    suplarr: TF,
    supmult: RF,
    supnE: LF,
    supne: FF,
    supplus: MF,
    supset: IF,
    Supset: zF,
    supseteq: PF,
    supseteqq: BF,
    supsetneq: NF,
    supsetneqq: OF,
    supsim: HF,
    supsub: UF,
    supsup: jF,
    swarhk: VF,
    swarr: $F,
    swArr: XF,
    swarrow: YF,
    swnwar: WF,
    szlig: GF,
    Tab: ZF,
    target: JF,
    Tau: KF,
    tau: QF,
    tbrk: tM,
    Tcaron: eM,
    tcaron: nM,
    Tcedil: rM,
    tcedil: oM,
    Tcy: sM,
    tcy: cM,
    tdot: iM,
    telrec: lM,
    Tfr: aM,
    tfr: uM,
    there4: fM,
    therefore: pM,
    Therefore: hM,
    Theta: dM,
    theta: gM,
    thetasym: mM,
    thetav: bM,
    thickapprox: vM,
    thicksim: _M,
    ThickSpace: xM,
    ThinSpace: kM,
    thinsp: yM,
    thkap: wM,
    thksim: CM,
    THORN: AM,
    thorn: EM,
    tilde: DM,
    Tilde: qM,
    TildeEqual: SM,
    TildeFullEqual: TM,
    TildeTilde: RM,
    timesbar: LM,
    timesb: FM,
    times: MM,
    timesd: IM,
    tint: zM,
    toea: PM,
    topbot: BM,
    topcir: NM,
    top: OM,
    Topf: HM,
    topf: UM,
    topfork: jM,
    tosa: VM,
    tprime: $M,
    trade: XM,
    TRADE: YM,
    triangle: WM,
    triangledown: GM,
    triangleleft: ZM,
    trianglelefteq: JM,
    triangleq: KM,
    triangleright: QM,
    trianglerighteq: tI,
    tridot: eI,
    trie: nI,
    triminus: rI,
    TripleDot: oI,
    triplus: sI,
    trisb: cI,
    tritime: iI,
    trpezium: lI,
    Tscr: aI,
    tscr: uI,
    TScy: fI,
    tscy: pI,
    TSHcy: hI,
    tshcy: dI,
    Tstrok: gI,
    tstrok: mI,
    twixt: bI,
    twoheadleftarrow: vI,
    twoheadrightarrow: _I,
    Uacute: xI,
    uacute: kI,
    uarr: yI,
    Uarr: wI,
    uArr: CI,
    Uarrocir: AI,
    Ubrcy: EI,
    ubrcy: DI,
    Ubreve: qI,
    ubreve: SI,
    Ucirc: TI,
    ucirc: RI,
    Ucy: LI,
    ucy: FI,
    udarr: MI,
    Udblac: II,
    udblac: zI,
    udhar: PI,
    ufisht: BI,
    Ufr: NI,
    ufr: OI,
    Ugrave: HI,
    ugrave: UI,
    uHar: jI,
    uharl: VI,
    uharr: $I,
    uhblk: XI,
    ulcorn: YI,
    ulcorner: WI,
    ulcrop: GI,
    ultri: ZI,
    Umacr: JI,
    umacr: KI,
    uml: QI,
    UnderBar: tz,
    UnderBrace: ez,
    UnderBracket: nz,
    UnderParenthesis: rz,
    Union: oz,
    UnionPlus: sz,
    Uogon: cz,
    uogon: iz,
    Uopf: lz,
    uopf: az,
    UpArrowBar: uz,
    uparrow: fz,
    UpArrow: pz,
    Uparrow: hz,
    UpArrowDownArrow: dz,
    updownarrow: gz,
    UpDownArrow: mz,
    Updownarrow: bz,
    UpEquilibrium: vz,
    upharpoonleft: _z,
    upharpoonright: xz,
    uplus: kz,
    UpperLeftArrow: yz,
    UpperRightArrow: wz,
    upsi: Cz,
    Upsi: Az,
    upsih: Ez,
    Upsilon: Dz,
    upsilon: qz,
    UpTeeArrow: Sz,
    UpTee: Tz,
    upuparrows: Rz,
    urcorn: Lz,
    urcorner: Fz,
    urcrop: Mz,
    Uring: Iz,
    uring: zz,
    urtri: Pz,
    Uscr: Bz,
    uscr: Nz,
    utdot: Oz,
    Utilde: Hz,
    utilde: Uz,
    utri: jz,
    utrif: Vz,
    uuarr: $z,
    Uuml: Xz,
    uuml: Yz,
    uwangle: Wz,
    vangrt: Gz,
    varepsilon: Zz,
    varkappa: Jz,
    varnothing: Kz,
    varphi: Qz,
    varpi: tP,
    varpropto: eP,
    varr: nP,
    vArr: rP,
    varrho: oP,
    varsigma: sP,
    varsubsetneq: cP,
    varsubsetneqq: iP,
    varsupsetneq: lP,
    varsupsetneqq: aP,
    vartheta: uP,
    vartriangleleft: fP,
    vartriangleright: pP,
    vBar: hP,
    Vbar: dP,
    vBarv: gP,
    Vcy: mP,
    vcy: bP,
    vdash: vP,
    vDash: _P,
    Vdash: xP,
    VDash: kP,
    Vdashl: yP,
    veebar: wP,
    vee: CP,
    Vee: AP,
    veeeq: EP,
    vellip: DP,
    verbar: qP,
    Verbar: SP,
    vert: TP,
    Vert: RP,
    VerticalBar: LP,
    VerticalLine: FP,
    VerticalSeparator: MP,
    VerticalTilde: IP,
    VeryThinSpace: zP,
    Vfr: PP,
    vfr: BP,
    vltri: NP,
    vnsub: OP,
    vnsup: HP,
    Vopf: UP,
    vopf: jP,
    vprop: VP,
    vrtri: $P,
    Vscr: XP,
    vscr: YP,
    vsubnE: WP,
    vsubne: GP,
    vsupnE: ZP,
    vsupne: JP,
    Vvdash: KP,
    vzigzag: QP,
    Wcirc: tB,
    wcirc: eB,
    wedbar: nB,
    wedge: rB,
    Wedge: oB,
    wedgeq: sB,
    weierp: cB,
    Wfr: iB,
    wfr: lB,
    Wopf: aB,
    wopf: uB,
    wp: fB,
    wr: pB,
    wreath: hB,
    Wscr: dB,
    wscr: gB,
    xcap: mB,
    xcirc: bB,
    xcup: vB,
    xdtri: _B,
    Xfr: xB,
    xfr: kB,
    xharr: yB,
    xhArr: wB,
    Xi: CB,
    xi: AB,
    xlarr: EB,
    xlArr: DB,
    xmap: qB,
    xnis: SB,
    xodot: TB,
    Xopf: RB,
    xopf: LB,
    xoplus: FB,
    xotime: MB,
    xrarr: IB,
    xrArr: zB,
    Xscr: PB,
    xscr: BB,
    xsqcup: NB,
    xuplus: OB,
    xutri: HB,
    xvee: UB,
    xwedge: jB,
    Yacute: VB,
    yacute: $B,
    YAcy: XB,
    yacy: YB,
    Ycirc: WB,
    ycirc: GB,
    Ycy: ZB,
    ycy: JB,
    yen: KB,
    Yfr: QB,
    yfr: tN,
    YIcy: eN,
    yicy: nN,
    Yopf: rN,
    yopf: oN,
    Yscr: sN,
    yscr: cN,
    YUcy: iN,
    yucy: lN,
    yuml: aN,
    Yuml: uN,
    Zacute: fN,
    zacute: pN,
    Zcaron: hN,
    zcaron: dN,
    Zcy: gN,
    zcy: mN,
    Zdot: bN,
    zdot: vN,
    zeetrf: _N,
    ZeroWidthSpace: xN,
    Zeta: kN,
    zeta: yN,
    zfr: wN,
    Zfr: CN,
    ZHcy: AN,
    zhcy: EN,
    zigrarr: DN,
    zopf: qN,
    Zopf: SN,
    Zscr: TN,
    zscr: RN,
    zwj: LN,
    zwnj: FN,
  }
;(function (e) {
  e.exports = MN
})(te)
var ee =
    /[!-#%-\*,-\/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4E\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD803[\uDF55-\uDF59]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDC4B-\uDC4F\uDC5B\uDC5D\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDE60-\uDE6C\uDF3C-\uDF3E]|\uD806[\uDC3B\uDE3F-\uDE46\uDE9A-\uDE9C\uDE9E-\uDEA2]|\uD807[\uDC41-\uDC45\uDC70\uDC71\uDEF7\uDEF8]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD81B[\uDE97-\uDE9A]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]|\uD83A[\uDD5E\uDD5F]/,
  tt = {},
  ke = {}
function IN(e) {
  var t,
    n,
    r = ke[e]
  if (r) return r
  for (r = ke[e] = [], t = 0; t < 128; t++)
    (n = String.fromCharCode(t)),
      /^[0-9a-z]$/i.test(n) ? r.push(n) : r.push('%' + ('0' + t.toString(16).toUpperCase()).slice(-2))
  for (t = 0; t < e.length; t++) r[e.charCodeAt(t)] = e[t]
  return r
}
function At(e, t, n) {
  var r,
    o,
    s,
    i,
    c,
    l = ''
  for (
    typeof t != 'string' && ((n = t), (t = At.defaultChars)),
      typeof n > 'u' && (n = !0),
      c = IN(t),
      r = 0,
      o = e.length;
    r < o;
    r++
  ) {
    if (((s = e.charCodeAt(r)), n && s === 37 && r + 2 < o && /^[0-9a-f]{2}$/i.test(e.slice(r + 1, r + 3)))) {
      ;(l += e.slice(r, r + 3)), (r += 2)
      continue
    }
    if (s < 128) {
      l += c[s]
      continue
    }
    if (s >= 55296 && s <= 57343) {
      if (s >= 55296 && s <= 56319 && r + 1 < o && ((i = e.charCodeAt(r + 1)), i >= 56320 && i <= 57343)) {
        ;(l += encodeURIComponent(e[r] + e[r + 1])), r++
        continue
      }
      l += '%EF%BF%BD'
      continue
    }
    l += encodeURIComponent(e[r])
  }
  return l
}
At.defaultChars = ";/?:@&=+$,-_.!~*'()#"
At.componentChars = "-_.!~*'()"
var zN = At,
  ye = {}
function PN(e) {
  var t,
    n,
    r = ye[e]
  if (r) return r
  for (r = ye[e] = [], t = 0; t < 128; t++) (n = String.fromCharCode(t)), r.push(n)
  for (t = 0; t < e.length; t++)
    (n = e.charCodeAt(t)), (r[n] = '%' + ('0' + n.toString(16).toUpperCase()).slice(-2))
  return r
}
function Et(e, t) {
  var n
  return (
    typeof t != 'string' && (t = Et.defaultChars),
    (n = PN(t)),
    e.replace(/(%[a-f0-9]{2})+/gi, function (r) {
      var o,
        s,
        i,
        c,
        l,
        a,
        u,
        f = ''
      for (o = 0, s = r.length; o < s; o += 3) {
        if (((i = parseInt(r.slice(o + 1, o + 3), 16)), i < 128)) {
          f += n[i]
          continue
        }
        if (
          (i & 224) === 192 &&
          o + 3 < s &&
          ((c = parseInt(r.slice(o + 4, o + 6), 16)), (c & 192) === 128)
        ) {
          ;(u = ((i << 6) & 1984) | (c & 63)),
            u < 128 ? (f += '\uFFFD\uFFFD') : (f += String.fromCharCode(u)),
            (o += 3)
          continue
        }
        if (
          (i & 240) === 224 &&
          o + 6 < s &&
          ((c = parseInt(r.slice(o + 4, o + 6), 16)),
          (l = parseInt(r.slice(o + 7, o + 9), 16)),
          (c & 192) === 128 && (l & 192) === 128)
        ) {
          ;(u = ((i << 12) & 61440) | ((c << 6) & 4032) | (l & 63)),
            u < 2048 || (u >= 55296 && u <= 57343)
              ? (f += '\uFFFD\uFFFD\uFFFD')
              : (f += String.fromCharCode(u)),
            (o += 6)
          continue
        }
        if (
          (i & 248) === 240 &&
          o + 9 < s &&
          ((c = parseInt(r.slice(o + 4, o + 6), 16)),
          (l = parseInt(r.slice(o + 7, o + 9), 16)),
          (a = parseInt(r.slice(o + 10, o + 12), 16)),
          (c & 192) === 128 && (l & 192) === 128 && (a & 192) === 128)
        ) {
          ;(u = ((i << 18) & 1835008) | ((c << 12) & 258048) | ((l << 6) & 4032) | (a & 63)),
            u < 65536 || u > 1114111
              ? (f += '\uFFFD\uFFFD\uFFFD\uFFFD')
              : ((u -= 65536), (f += String.fromCharCode(55296 + (u >> 10), 56320 + (u & 1023)))),
            (o += 9)
          continue
        }
        f += '\uFFFD'
      }
      return f
    })
  )
}
Et.defaultChars = ';/?:@&=+$,#'
Et.componentChars = ''
var BN = Et,
  NN = function (t) {
    var n = ''
    return (
      (n += t.protocol || ''),
      (n += t.slashes ? '//' : ''),
      (n += t.auth ? t.auth + '@' : ''),
      t.hostname && t.hostname.indexOf(':') !== -1 ? (n += '[' + t.hostname + ']') : (n += t.hostname || ''),
      (n += t.port ? ':' + t.port : ''),
      (n += t.pathname || ''),
      (n += t.search || ''),
      (n += t.hash || ''),
      n
    )
  }
function yt() {
  ;(this.protocol = null),
    (this.slashes = null),
    (this.auth = null),
    (this.port = null),
    (this.hostname = null),
    (this.hash = null),
    (this.search = null),
    (this.pathname = null)
}
var ON = /^([a-z0-9.+-]+:)/i,
  HN = /:[0-9]*$/,
  UN = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,
  jN = [
    '<',
    '>',
    '"',
    '`',
    ' ',
    '\r',
    `
`,
    '	',
  ],
  VN = ['{', '}', '|', '\\', '^', '`'].concat(jN),
  $N = ["'"].concat(VN),
  we = ['%', '/', '?', ';', '#'].concat($N),
  Ce = ['/', '?', '#'],
  XN = 255,
  Ae = /^[+a-z0-9A-Z_-]{0,63}$/,
  YN = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
  Ee = { javascript: !0, 'javascript:': !0 },
  De = {
    http: !0,
    https: !0,
    ftp: !0,
    gopher: !0,
    file: !0,
    'http:': !0,
    'https:': !0,
    'ftp:': !0,
    'gopher:': !0,
    'file:': !0,
  }
function WN(e, t) {
  if (e && e instanceof yt) return e
  var n = new yt()
  return n.parse(e, t), n
}
yt.prototype.parse = function (e, t) {
  var n,
    r,
    o,
    s,
    i,
    c = e
  if (((c = c.trim()), !t && e.split('#').length === 1)) {
    var l = UN.exec(c)
    if (l) return (this.pathname = l[1]), l[2] && (this.search = l[2]), this
  }
  var a = ON.exec(c)
  if (
    (a && ((a = a[0]), (o = a.toLowerCase()), (this.protocol = a), (c = c.substr(a.length))),
    (t || a || c.match(/^\/\/[^@\/]+@[^@\/]+/)) &&
      ((i = c.substr(0, 2) === '//'), i && !(a && Ee[a]) && ((c = c.substr(2)), (this.slashes = !0))),
    !Ee[a] && (i || (a && !De[a])))
  ) {
    var u = -1
    for (n = 0; n < Ce.length; n++) (s = c.indexOf(Ce[n])), s !== -1 && (u === -1 || s < u) && (u = s)
    var f, h
    for (
      u === -1 ? (h = c.lastIndexOf('@')) : (h = c.lastIndexOf('@', u)),
        h !== -1 && ((f = c.slice(0, h)), (c = c.slice(h + 1)), (this.auth = f)),
        u = -1,
        n = 0;
      n < we.length;
      n++
    )
      (s = c.indexOf(we[n])), s !== -1 && (u === -1 || s < u) && (u = s)
    u === -1 && (u = c.length), c[u - 1] === ':' && u--
    var p = c.slice(0, u)
    ;(c = c.slice(u)), this.parseHost(p), (this.hostname = this.hostname || '')
    var d = this.hostname[0] === '[' && this.hostname[this.hostname.length - 1] === ']'
    if (!d) {
      var m = this.hostname.split(/\./)
      for (n = 0, r = m.length; n < r; n++) {
        var _ = m[n]
        if (!!_ && !_.match(Ae)) {
          for (var b = '', g = 0, x = _.length; g < x; g++) _.charCodeAt(g) > 127 ? (b += 'x') : (b += _[g])
          if (!b.match(Ae)) {
            var y = m.slice(0, n),
              w = m.slice(n + 1),
              k = _.match(YN)
            k && (y.push(k[1]), w.unshift(k[2])),
              w.length && (c = w.join('.') + c),
              (this.hostname = y.join('.'))
            break
          }
        }
      }
    }
    this.hostname.length > XN && (this.hostname = ''),
      d && (this.hostname = this.hostname.substr(1, this.hostname.length - 2))
  }
  var D = c.indexOf('#')
  D !== -1 && ((this.hash = c.substr(D)), (c = c.slice(0, D)))
  var L = c.indexOf('?')
  return (
    L !== -1 && ((this.search = c.substr(L)), (c = c.slice(0, L))),
    c && (this.pathname = c),
    De[o] && this.hostname && !this.pathname && (this.pathname = ''),
    this
  )
}
yt.prototype.parseHost = function (e) {
  var t = HN.exec(e)
  t && ((t = t[0]), t !== ':' && (this.port = t.substr(1)), (e = e.substr(0, e.length - t.length))),
    e && (this.hostname = e)
}
var GN = WN
tt.encode = zN
tt.decode = BN
tt.format = NN
tt.parse = GN
var V = {},
  Mt,
  qe
function mn() {
  return (
    qe ||
      ((qe = 1),
      (Mt =
        /[\0-\uD7FF\uE000-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/)),
    Mt
  )
}
var It, Se
function bn() {
  return Se || ((Se = 1), (It = /[\0-\x1F\x7F-\x9F]/)), It
}
var zt, Te
function ZN() {
  return (
    Te ||
      ((Te = 1),
      (zt =
        /[\xAD\u0600-\u0605\u061C\u06DD\u070F\u08E2\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804[\uDCBD\uDCCD]|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/)),
    zt
  )
}
var Pt, Re
function vn() {
  return Re || ((Re = 1), (Pt = /[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/)), Pt
}
var Le
function JN() {
  return Le || ((Le = 1), (V.Any = mn()), (V.Cc = bn()), (V.Cf = ZN()), (V.P = ee), (V.Z = vn())), V
}
;(function (e) {
  function t(v) {
    return Object.prototype.toString.call(v)
  }
  function n(v) {
    return t(v) === '[object String]'
  }
  var r = Object.prototype.hasOwnProperty
  function o(v, T) {
    return r.call(v, T)
  }
  function s(v) {
    var T = Array.prototype.slice.call(arguments, 1)
    return (
      T.forEach(function (A) {
        if (!!A) {
          if (typeof A != 'object') throw new TypeError(A + 'must be object')
          Object.keys(A).forEach(function (U) {
            v[U] = A[U]
          })
        }
      }),
      v
    )
  }
  function i(v, T, A) {
    return [].concat(v.slice(0, T), A, v.slice(T + 1))
  }
  function c(v) {
    return !(
      (v >= 55296 && v <= 57343) ||
      (v >= 64976 && v <= 65007) ||
      (v & 65535) === 65535 ||
      (v & 65535) === 65534 ||
      (v >= 0 && v <= 8) ||
      v === 11 ||
      (v >= 14 && v <= 31) ||
      (v >= 127 && v <= 159) ||
      v > 1114111
    )
  }
  function l(v) {
    if (v > 65535) {
      v -= 65536
      var T = 55296 + (v >> 10),
        A = 56320 + (v & 1023)
      return String.fromCharCode(T, A)
    }
    return String.fromCharCode(v)
  }
  var a = /\\([!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~])/g,
    u = /&([a-z#][a-z0-9]{1,31});/gi,
    f = new RegExp(a.source + '|' + u.source, 'gi'),
    h = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))/i,
    p = te.exports
  function d(v, T) {
    var A = 0
    return o(p, T)
      ? p[T]
      : T.charCodeAt(0) === 35 &&
        h.test(T) &&
        ((A = T[1].toLowerCase() === 'x' ? parseInt(T.slice(2), 16) : parseInt(T.slice(1), 10)), c(A))
      ? l(A)
      : v
  }
  function m(v) {
    return v.indexOf('\\') < 0 ? v : v.replace(a, '$1')
  }
  function _(v) {
    return v.indexOf('\\') < 0 && v.indexOf('&') < 0
      ? v
      : v.replace(f, function (T, A, U) {
          return A || d(T, U)
        })
  }
  var b = /[&<>"]/,
    g = /[&<>"]/g,
    x = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
  function y(v) {
    return x[v]
  }
  function w(v) {
    return b.test(v) ? v.replace(g, y) : v
  }
  var k = /[.?*+^$[\]\\(){}|-]/g
  function D(v) {
    return v.replace(k, '\\$&')
  }
  function L(v) {
    switch (v) {
      case 9:
      case 32:
        return !0
    }
    return !1
  }
  function Y(v) {
    if (v >= 8192 && v <= 8202) return !0
    switch (v) {
      case 9:
      case 10:
      case 11:
      case 12:
      case 13:
      case 32:
      case 160:
      case 5760:
      case 8239:
      case 8287:
      case 12288:
        return !0
    }
    return !1
  }
  var C = ee
  function S(v) {
    return C.test(v)
  }
  function rt(v) {
    switch (v) {
      case 33:
      case 34:
      case 35:
      case 36:
      case 37:
      case 38:
      case 39:
      case 40:
      case 41:
      case 42:
      case 43:
      case 44:
      case 45:
      case 46:
      case 47:
      case 58:
      case 59:
      case 60:
      case 61:
      case 62:
      case 63:
      case 64:
      case 91:
      case 92:
      case 93:
      case 94:
      case 95:
      case 96:
      case 123:
      case 124:
      case 125:
      case 126:
        return !0
      default:
        return !1
    }
  }
  function W(v) {
    return (
      (v = v.trim().replace(/\s+/g, ' ')),
      '\u1E9E'.toLowerCase() === '\u1E7E' && (v = v.replace(/ẞ/g, '\xDF')),
      v.toLowerCase().toUpperCase()
    )
  }
  ;(e.lib = {}),
    (e.lib.mdurl = tt),
    (e.lib.ucmicro = JN()),
    (e.assign = s),
    (e.isString = n),
    (e.has = o),
    (e.unescapeMd = m),
    (e.unescapeAll = _),
    (e.isValidEntityCode = c),
    (e.fromCodePoint = l),
    (e.escapeHtml = w),
    (e.arrayReplaceAt = i),
    (e.isSpace = L),
    (e.isWhiteSpace = Y),
    (e.isMdAsciiPunct = rt),
    (e.isPunctChar = S),
    (e.escapeRE = D),
    (e.normalizeReference = W)
})(E)
var Dt = {},
  KN = function (t, n, r) {
    var o,
      s,
      i,
      c,
      l = -1,
      a = t.posMax,
      u = t.pos
    for (t.pos = n + 1, o = 1; t.pos < a; ) {
      if (((i = t.src.charCodeAt(t.pos)), i === 93 && (o--, o === 0))) {
        s = !0
        break
      }
      if (((c = t.pos), t.md.inline.skipToken(t), i === 91)) {
        if (c === t.pos - 1) o++
        else if (r) return (t.pos = u), -1
      }
    }
    return s && (l = t.pos), (t.pos = u), l
  },
  Fe = E.unescapeAll,
  QN = function (t, n, r) {
    var o,
      s,
      i = 0,
      c = n,
      l = { ok: !1, pos: 0, lines: 0, str: '' }
    if (t.charCodeAt(n) === 60) {
      for (n++; n < r; ) {
        if (((o = t.charCodeAt(n)), o === 10 || o === 60)) return l
        if (o === 62) return (l.pos = n + 1), (l.str = Fe(t.slice(c + 1, n))), (l.ok = !0), l
        if (o === 92 && n + 1 < r) {
          n += 2
          continue
        }
        n++
      }
      return l
    }
    for (s = 0; n < r && ((o = t.charCodeAt(n)), !(o === 32 || o < 32 || o === 127)); ) {
      if (o === 92 && n + 1 < r) {
        if (t.charCodeAt(n + 1) === 32) break
        n += 2
        continue
      }
      if (o === 40 && (s++, s > 32)) return l
      if (o === 41) {
        if (s === 0) break
        s--
      }
      n++
    }
    return c === n || s !== 0 || ((l.str = Fe(t.slice(c, n))), (l.lines = i), (l.pos = n), (l.ok = !0)), l
  },
  t3 = E.unescapeAll,
  e3 = function (t, n, r) {
    var o,
      s,
      i = 0,
      c = n,
      l = { ok: !1, pos: 0, lines: 0, str: '' }
    if (n >= r || ((s = t.charCodeAt(n)), s !== 34 && s !== 39 && s !== 40)) return l
    for (n++, s === 40 && (s = 41); n < r; ) {
      if (((o = t.charCodeAt(n)), o === s))
        return (l.pos = n + 1), (l.lines = i), (l.str = t3(t.slice(c + 1, n))), (l.ok = !0), l
      if (o === 40 && s === 41) return l
      o === 10 ? i++ : o === 92 && n + 1 < r && (n++, t.charCodeAt(n) === 10 && i++), n++
    }
    return l
  }
Dt.parseLinkLabel = KN
Dt.parseLinkDestination = QN
Dt.parseLinkTitle = e3
var n3 = E.assign,
  r3 = E.unescapeAll,
  X = E.escapeHtml,
  N = {}
N.code_inline = function (e, t, n, r, o) {
  var s = e[t]
  return '<code' + o.renderAttrs(s) + '>' + X(e[t].content) + '</code>'
}
N.code_block = function (e, t, n, r, o) {
  var s = e[t]
  return (
    '<pre' +
    o.renderAttrs(s) +
    '><code>' +
    X(e[t].content) +
    `</code></pre>
`
  )
}
N.fence = function (e, t, n, r, o) {
  var s = e[t],
    i = s.info ? r3(s.info).trim() : '',
    c = '',
    l = '',
    a,
    u,
    f,
    h,
    p
  return (
    i && ((f = i.split(/(\s+)/g)), (c = f[0]), (l = f.slice(2).join(''))),
    n.highlight ? (a = n.highlight(s.content, c, l) || X(s.content)) : (a = X(s.content)),
    a.indexOf('<pre') === 0
      ? a +
        `
`
      : i
      ? ((u = s.attrIndex('class')),
        (h = s.attrs ? s.attrs.slice() : []),
        u < 0
          ? h.push(['class', n.langPrefix + c])
          : ((h[u] = h[u].slice()), (h[u][1] += ' ' + n.langPrefix + c)),
        (p = { attrs: h }),
        '<pre><code' +
          o.renderAttrs(p) +
          '>' +
          a +
          `</code></pre>
`)
      : '<pre><code' +
        o.renderAttrs(s) +
        '>' +
        a +
        `</code></pre>
`
  )
}
N.image = function (e, t, n, r, o) {
  var s = e[t]
  return (s.attrs[s.attrIndex('alt')][1] = o.renderInlineAsText(s.children, n, r)), o.renderToken(e, t, n)
}
N.hardbreak = function (e, t, n) {
  return n.xhtmlOut
    ? `<br />
`
    : `<br>
`
}
N.softbreak = function (e, t, n) {
  return n.breaks
    ? n.xhtmlOut
      ? `<br />
`
      : `<br>
`
    : `
`
}
N.text = function (e, t) {
  return X(e[t].content)
}
N.html_block = function (e, t) {
  return e[t].content
}
N.html_inline = function (e, t) {
  return e[t].content
}
function et() {
  this.rules = n3({}, N)
}
et.prototype.renderAttrs = function (t) {
  var n, r, o
  if (!t.attrs) return ''
  for (o = '', n = 0, r = t.attrs.length; n < r; n++)
    o += ' ' + X(t.attrs[n][0]) + '="' + X(t.attrs[n][1]) + '"'
  return o
}
et.prototype.renderToken = function (t, n, r) {
  var o,
    s = '',
    i = !1,
    c = t[n]
  return c.hidden
    ? ''
    : (c.block &&
        c.nesting !== -1 &&
        n &&
        t[n - 1].hidden &&
        (s += `
`),
      (s += (c.nesting === -1 ? '</' : '<') + c.tag),
      (s += this.renderAttrs(c)),
      c.nesting === 0 && r.xhtmlOut && (s += ' /'),
      c.block &&
        ((i = !0),
        c.nesting === 1 &&
          n + 1 < t.length &&
          ((o = t[n + 1]),
          (o.type === 'inline' || o.hidden || (o.nesting === -1 && o.tag === c.tag)) && (i = !1))),
      (s += i
        ? `>
`
        : '>'),
      s)
}
et.prototype.renderInline = function (e, t, n) {
  for (var r, o = '', s = this.rules, i = 0, c = e.length; i < c; i++)
    (r = e[i].type), typeof s[r] < 'u' ? (o += s[r](e, i, t, n, this)) : (o += this.renderToken(e, i, t))
  return o
}
et.prototype.renderInlineAsText = function (e, t, n) {
  for (var r = '', o = 0, s = e.length; o < s; o++)
    e[o].type === 'text'
      ? (r += e[o].content)
      : e[o].type === 'image'
      ? (r += this.renderInlineAsText(e[o].children, t, n))
      : e[o].type === 'softbreak' &&
        (r += `
`)
  return r
}
et.prototype.render = function (e, t, n) {
  var r,
    o,
    s,
    i = '',
    c = this.rules
  for (r = 0, o = e.length; r < o; r++)
    (s = e[r].type),
      s === 'inline'
        ? (i += this.renderInline(e[r].children, t, n))
        : typeof c[s] < 'u'
        ? (i += c[e[r].type](e, r, t, n, this))
        : (i += this.renderToken(e, r, t, n))
  return i
}
var o3 = et
function P() {
  ;(this.__rules__ = []), (this.__cache__ = null)
}
P.prototype.__find__ = function (e) {
  for (var t = 0; t < this.__rules__.length; t++) if (this.__rules__[t].name === e) return t
  return -1
}
P.prototype.__compile__ = function () {
  var e = this,
    t = ['']
  e.__rules__.forEach(function (n) {
    !n.enabled ||
      n.alt.forEach(function (r) {
        t.indexOf(r) < 0 && t.push(r)
      })
  }),
    (e.__cache__ = {}),
    t.forEach(function (n) {
      ;(e.__cache__[n] = []),
        e.__rules__.forEach(function (r) {
          !r.enabled || (n && r.alt.indexOf(n) < 0) || e.__cache__[n].push(r.fn)
        })
    })
}
P.prototype.at = function (e, t, n) {
  var r = this.__find__(e),
    o = n || {}
  if (r === -1) throw new Error('Parser rule not found: ' + e)
  ;(this.__rules__[r].fn = t), (this.__rules__[r].alt = o.alt || []), (this.__cache__ = null)
}
P.prototype.before = function (e, t, n, r) {
  var o = this.__find__(e),
    s = r || {}
  if (o === -1) throw new Error('Parser rule not found: ' + e)
  this.__rules__.splice(o, 0, { name: t, enabled: !0, fn: n, alt: s.alt || [] }), (this.__cache__ = null)
}
P.prototype.after = function (e, t, n, r) {
  var o = this.__find__(e),
    s = r || {}
  if (o === -1) throw new Error('Parser rule not found: ' + e)
  this.__rules__.splice(o + 1, 0, { name: t, enabled: !0, fn: n, alt: s.alt || [] }), (this.__cache__ = null)
}
P.prototype.push = function (e, t, n) {
  var r = n || {}
  this.__rules__.push({ name: e, enabled: !0, fn: t, alt: r.alt || [] }), (this.__cache__ = null)
}
P.prototype.enable = function (e, t) {
  Array.isArray(e) || (e = [e])
  var n = []
  return (
    e.forEach(function (r) {
      var o = this.__find__(r)
      if (o < 0) {
        if (t) return
        throw new Error('Rules manager: invalid rule name ' + r)
      }
      ;(this.__rules__[o].enabled = !0), n.push(r)
    }, this),
    (this.__cache__ = null),
    n
  )
}
P.prototype.enableOnly = function (e, t) {
  Array.isArray(e) || (e = [e]),
    this.__rules__.forEach(function (n) {
      n.enabled = !1
    }),
    this.enable(e, t)
}
P.prototype.disable = function (e, t) {
  Array.isArray(e) || (e = [e])
  var n = []
  return (
    e.forEach(function (r) {
      var o = this.__find__(r)
      if (o < 0) {
        if (t) return
        throw new Error('Rules manager: invalid rule name ' + r)
      }
      ;(this.__rules__[o].enabled = !1), n.push(r)
    }, this),
    (this.__cache__ = null),
    n
  )
}
P.prototype.getRules = function (e) {
  return this.__cache__ === null && this.__compile__(), this.__cache__[e] || []
}
var ne = P,
  s3 = /\r\n?|\n/g,
  c3 = /\0/g,
  i3 = function (t) {
    var n
    ;(n = t.src.replace(
      s3,
      `
`,
    )),
      (n = n.replace(c3, '\uFFFD')),
      (t.src = n)
  },
  l3 = function (t) {
    var n
    t.inlineMode
      ? ((n = new t.Token('inline', '', 0)),
        (n.content = t.src),
        (n.map = [0, 1]),
        (n.children = []),
        t.tokens.push(n))
      : t.md.block.parse(t.src, t.md, t.env, t.tokens)
  },
  a3 = function (t) {
    var n = t.tokens,
      r,
      o,
      s
    for (o = 0, s = n.length; o < s; o++)
      (r = n[o]), r.type === 'inline' && t.md.inline.parse(r.content, t.md, t.env, r.children)
  },
  u3 = E.arrayReplaceAt
function f3(e) {
  return /^<a[>\s]/i.test(e)
}
function p3(e) {
  return /^<\/a\s*>/i.test(e)
}
var h3 = function (t) {
    var n,
      r,
      o,
      s,
      i,
      c,
      l,
      a,
      u,
      f,
      h,
      p,
      d,
      m,
      _,
      b,
      g = t.tokens,
      x
    if (!!t.md.options.linkify) {
      for (r = 0, o = g.length; r < o; r++)
        if (!(g[r].type !== 'inline' || !t.md.linkify.pretest(g[r].content)))
          for (s = g[r].children, d = 0, n = s.length - 1; n >= 0; n--) {
            if (((c = s[n]), c.type === 'link_close')) {
              for (n--; s[n].level !== c.level && s[n].type !== 'link_open'; ) n--
              continue
            }
            if (
              (c.type === 'html_inline' && (f3(c.content) && d > 0 && d--, p3(c.content) && d++),
              !(d > 0) && c.type === 'text' && t.md.linkify.test(c.content))
            ) {
              for (
                u = c.content,
                  x = t.md.linkify.match(u),
                  l = [],
                  p = c.level,
                  h = 0,
                  x.length > 0 &&
                    x[0].index === 0 &&
                    n > 0 &&
                    s[n - 1].type === 'text_special' &&
                    (x = x.slice(1)),
                  a = 0;
                a < x.length;
                a++
              )
                (m = x[a].url),
                  (_ = t.md.normalizeLink(m)),
                  t.md.validateLink(_) &&
                    ((b = x[a].text),
                    x[a].schema
                      ? x[a].schema === 'mailto:' && !/^mailto:/i.test(b)
                        ? (b = t.md.normalizeLinkText('mailto:' + b).replace(/^mailto:/, ''))
                        : (b = t.md.normalizeLinkText(b))
                      : (b = t.md.normalizeLinkText('http://' + b).replace(/^http:\/\//, '')),
                    (f = x[a].index),
                    f > h &&
                      ((i = new t.Token('text', '', 0)),
                      (i.content = u.slice(h, f)),
                      (i.level = p),
                      l.push(i)),
                    (i = new t.Token('link_open', 'a', 1)),
                    (i.attrs = [['href', _]]),
                    (i.level = p++),
                    (i.markup = 'linkify'),
                    (i.info = 'auto'),
                    l.push(i),
                    (i = new t.Token('text', '', 0)),
                    (i.content = b),
                    (i.level = p),
                    l.push(i),
                    (i = new t.Token('link_close', 'a', -1)),
                    (i.level = --p),
                    (i.markup = 'linkify'),
                    (i.info = 'auto'),
                    l.push(i),
                    (h = x[a].lastIndex))
              h < u.length &&
                ((i = new t.Token('text', '', 0)), (i.content = u.slice(h)), (i.level = p), l.push(i)),
                (g[r].children = s = u3(s, n, l))
            }
          }
    }
  },
  _n = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/,
  d3 = /\((c|tm|r)\)/i,
  g3 = /\((c|tm|r)\)/gi,
  m3 = { c: '\xA9', r: '\xAE', tm: '\u2122' }
function b3(e, t) {
  return m3[t.toLowerCase()]
}
function v3(e) {
  var t,
    n,
    r = 0
  for (t = e.length - 1; t >= 0; t--)
    (n = e[t]),
      n.type === 'text' && !r && (n.content = n.content.replace(g3, b3)),
      n.type === 'link_open' && n.info === 'auto' && r--,
      n.type === 'link_close' && n.info === 'auto' && r++
}
function _3(e) {
  var t,
    n,
    r = 0
  for (t = e.length - 1; t >= 0; t--)
    (n = e[t]),
      n.type === 'text' &&
        !r &&
        _n.test(n.content) &&
        (n.content = n.content
          .replace(/\+-/g, '\xB1')
          .replace(/\.{2,}/g, '\u2026')
          .replace(/([?!])…/g, '$1..')
          .replace(/([?!]){4,}/g, '$1$1$1')
          .replace(/,{2,}/g, ',')
          .replace(/(^|[^-])---(?=[^-]|$)/gm, '$1\u2014')
          .replace(/(^|\s)--(?=\s|$)/gm, '$1\u2013')
          .replace(/(^|[^-\s])--(?=[^-\s]|$)/gm, '$1\u2013')),
      n.type === 'link_open' && n.info === 'auto' && r--,
      n.type === 'link_close' && n.info === 'auto' && r++
}
var x3 = function (t) {
    var n
    if (!!t.md.options.typographer)
      for (n = t.tokens.length - 1; n >= 0; n--)
        t.tokens[n].type === 'inline' &&
          (d3.test(t.tokens[n].content) && v3(t.tokens[n].children),
          _n.test(t.tokens[n].content) && _3(t.tokens[n].children))
  },
  Me = E.isWhiteSpace,
  Ie = E.isPunctChar,
  ze = E.isMdAsciiPunct,
  k3 = /['"]/,
  Pe = /['"]/g,
  Be = '\u2019'
function dt(e, t, n) {
  return e.slice(0, t) + n + e.slice(t + 1)
}
function y3(e, t) {
  var n, r, o, s, i, c, l, a, u, f, h, p, d, m, _, b, g, x, y, w, k
  for (y = [], n = 0; n < e.length; n++) {
    for (r = e[n], l = e[n].level, g = y.length - 1; g >= 0 && !(y[g].level <= l); g--);
    if (((y.length = g + 1), r.type !== 'text')) continue
    ;(o = r.content), (i = 0), (c = o.length)
    t: for (; i < c && ((Pe.lastIndex = i), (s = Pe.exec(o)), !!s); ) {
      if (((_ = b = !0), (i = s.index + 1), (x = s[0] === "'"), (u = 32), s.index - 1 >= 0))
        u = o.charCodeAt(s.index - 1)
      else
        for (g = n - 1; g >= 0 && !(e[g].type === 'softbreak' || e[g].type === 'hardbreak'); g--)
          if (!!e[g].content) {
            u = e[g].content.charCodeAt(e[g].content.length - 1)
            break
          }
      if (((f = 32), i < c)) f = o.charCodeAt(i)
      else
        for (g = n + 1; g < e.length && !(e[g].type === 'softbreak' || e[g].type === 'hardbreak'); g++)
          if (!!e[g].content) {
            f = e[g].content.charCodeAt(0)
            break
          }
      if (
        ((h = ze(u) || Ie(String.fromCharCode(u))),
        (p = ze(f) || Ie(String.fromCharCode(f))),
        (d = Me(u)),
        (m = Me(f)),
        m ? (_ = !1) : p && (d || h || (_ = !1)),
        d ? (b = !1) : h && (m || p || (b = !1)),
        f === 34 && s[0] === '"' && u >= 48 && u <= 57 && (b = _ = !1),
        _ && b && ((_ = h), (b = p)),
        !_ && !b)
      ) {
        x && (r.content = dt(r.content, s.index, Be))
        continue
      }
      if (b) {
        for (g = y.length - 1; g >= 0 && ((a = y[g]), !(y[g].level < l)); g--)
          if (a.single === x && y[g].level === l) {
            ;(a = y[g]),
              x
                ? ((w = t.md.options.quotes[2]), (k = t.md.options.quotes[3]))
                : ((w = t.md.options.quotes[0]), (k = t.md.options.quotes[1])),
              (r.content = dt(r.content, s.index, k)),
              (e[a.token].content = dt(e[a.token].content, a.pos, w)),
              (i += k.length - 1),
              a.token === n && (i += w.length - 1),
              (o = r.content),
              (c = o.length),
              (y.length = g)
            continue t
          }
      }
      _
        ? y.push({ token: n, pos: s.index, single: x, level: l })
        : b && x && (r.content = dt(r.content, s.index, Be))
    }
  }
}
var w3 = function (t) {
    var n
    if (!!t.md.options.typographer)
      for (n = t.tokens.length - 1; n >= 0; n--)
        t.tokens[n].type !== 'inline' || !k3.test(t.tokens[n].content) || y3(t.tokens[n].children, t)
  },
  C3 = function (t) {
    var n,
      r,
      o,
      s,
      i,
      c,
      l = t.tokens
    for (n = 0, r = l.length; n < r; n++)
      if (l[n].type === 'inline') {
        for (o = l[n].children, i = o.length, s = 0; s < i; s++)
          o[s].type === 'text_special' && (o[s].type = 'text')
        for (s = c = 0; s < i; s++)
          o[s].type === 'text' && s + 1 < i && o[s + 1].type === 'text'
            ? (o[s + 1].content = o[s].content + o[s + 1].content)
            : (s !== c && (o[c] = o[s]), c++)
        s !== c && (o.length = c)
      }
  }
function nt(e, t, n) {
  ;(this.type = e),
    (this.tag = t),
    (this.attrs = null),
    (this.map = null),
    (this.nesting = n),
    (this.level = 0),
    (this.children = null),
    (this.content = ''),
    (this.markup = ''),
    (this.info = ''),
    (this.meta = null),
    (this.block = !1),
    (this.hidden = !1)
}
nt.prototype.attrIndex = function (t) {
  var n, r, o
  if (!this.attrs) return -1
  for (n = this.attrs, r = 0, o = n.length; r < o; r++) if (n[r][0] === t) return r
  return -1
}
nt.prototype.attrPush = function (t) {
  this.attrs ? this.attrs.push(t) : (this.attrs = [t])
}
nt.prototype.attrSet = function (t, n) {
  var r = this.attrIndex(t),
    o = [t, n]
  r < 0 ? this.attrPush(o) : (this.attrs[r] = o)
}
nt.prototype.attrGet = function (t) {
  var n = this.attrIndex(t),
    r = null
  return n >= 0 && (r = this.attrs[n][1]), r
}
nt.prototype.attrJoin = function (t, n) {
  var r = this.attrIndex(t)
  r < 0 ? this.attrPush([t, n]) : (this.attrs[r][1] = this.attrs[r][1] + ' ' + n)
}
var re = nt,
  A3 = re
function xn(e, t, n) {
  ;(this.src = e), (this.env = n), (this.tokens = []), (this.inlineMode = !1), (this.md = t)
}
xn.prototype.Token = A3
var E3 = xn,
  D3 = ne,
  Bt = [
    ['normalize', i3],
    ['block', l3],
    ['inline', a3],
    ['linkify', h3],
    ['replacements', x3],
    ['smartquotes', w3],
    ['text_join', C3],
  ]
function oe() {
  this.ruler = new D3()
  for (var e = 0; e < Bt.length; e++) this.ruler.push(Bt[e][0], Bt[e][1])
}
oe.prototype.process = function (e) {
  var t, n, r
  for (r = this.ruler.getRules(''), t = 0, n = r.length; t < n; t++) r[t](e)
}
oe.prototype.State = E3
var q3 = oe,
  Nt = E.isSpace
function Ot(e, t) {
  var n = e.bMarks[t] + e.tShift[t],
    r = e.eMarks[t]
  return e.src.slice(n, r)
}
function Ne(e) {
  var t = [],
    n = 0,
    r = e.length,
    o,
    s = !1,
    i = 0,
    c = ''
  for (o = e.charCodeAt(n); n < r; )
    o === 124 &&
      (s ? ((c += e.substring(i, n - 1)), (i = n)) : (t.push(c + e.substring(i, n)), (c = ''), (i = n + 1))),
      (s = o === 92),
      n++,
      (o = e.charCodeAt(n))
  return t.push(c + e.substring(i)), t
}
var S3 = function (t, n, r, o) {
    var s, i, c, l, a, u, f, h, p, d, m, _, b, g, x, y, w, k
    if (
      n + 2 > r ||
      ((u = n + 1), t.sCount[u] < t.blkIndent) ||
      t.sCount[u] - t.blkIndent >= 4 ||
      ((c = t.bMarks[u] + t.tShift[u]), c >= t.eMarks[u]) ||
      ((w = t.src.charCodeAt(c++)), w !== 124 && w !== 45 && w !== 58) ||
      c >= t.eMarks[u] ||
      ((k = t.src.charCodeAt(c++)), k !== 124 && k !== 45 && k !== 58 && !Nt(k)) ||
      (w === 45 && Nt(k))
    )
      return !1
    for (; c < t.eMarks[u]; ) {
      if (((s = t.src.charCodeAt(c)), s !== 124 && s !== 45 && s !== 58 && !Nt(s))) return !1
      c++
    }
    for (i = Ot(t, n + 1), f = i.split('|'), d = [], l = 0; l < f.length; l++) {
      if (((m = f[l].trim()), !m)) {
        if (l === 0 || l === f.length - 1) continue
        return !1
      }
      if (!/^:?-+:?$/.test(m)) return !1
      m.charCodeAt(m.length - 1) === 58
        ? d.push(m.charCodeAt(0) === 58 ? 'center' : 'right')
        : m.charCodeAt(0) === 58
        ? d.push('left')
        : d.push('')
    }
    if (
      ((i = Ot(t, n).trim()),
      i.indexOf('|') === -1 ||
        t.sCount[n] - t.blkIndent >= 4 ||
        ((f = Ne(i)),
        f.length && f[0] === '' && f.shift(),
        f.length && f[f.length - 1] === '' && f.pop(),
        (h = f.length),
        h === 0 || h !== d.length))
    )
      return !1
    if (o) return !0
    for (
      g = t.parentType,
        t.parentType = 'table',
        y = t.md.block.ruler.getRules('blockquote'),
        p = t.push('table_open', 'table', 1),
        p.map = _ = [n, 0],
        p = t.push('thead_open', 'thead', 1),
        p.map = [n, n + 1],
        p = t.push('tr_open', 'tr', 1),
        p.map = [n, n + 1],
        l = 0;
      l < f.length;
      l++
    )
      (p = t.push('th_open', 'th', 1)),
        d[l] && (p.attrs = [['style', 'text-align:' + d[l]]]),
        (p = t.push('inline', '', 0)),
        (p.content = f[l].trim()),
        (p.children = []),
        (p = t.push('th_close', 'th', -1))
    for (
      p = t.push('tr_close', 'tr', -1), p = t.push('thead_close', 'thead', -1), u = n + 2;
      u < r && !(t.sCount[u] < t.blkIndent);
      u++
    ) {
      for (x = !1, l = 0, a = y.length; l < a; l++)
        if (y[l](t, u, r, !0)) {
          x = !0
          break
        }
      if (x || ((i = Ot(t, u).trim()), !i) || t.sCount[u] - t.blkIndent >= 4) break
      for (
        f = Ne(i),
          f.length && f[0] === '' && f.shift(),
          f.length && f[f.length - 1] === '' && f.pop(),
          u === n + 2 && ((p = t.push('tbody_open', 'tbody', 1)), (p.map = b = [n + 2, 0])),
          p = t.push('tr_open', 'tr', 1),
          p.map = [u, u + 1],
          l = 0;
        l < h;
        l++
      )
        (p = t.push('td_open', 'td', 1)),
          d[l] && (p.attrs = [['style', 'text-align:' + d[l]]]),
          (p = t.push('inline', '', 0)),
          (p.content = f[l] ? f[l].trim() : ''),
          (p.children = []),
          (p = t.push('td_close', 'td', -1))
      p = t.push('tr_close', 'tr', -1)
    }
    return (
      b && ((p = t.push('tbody_close', 'tbody', -1)), (b[1] = u)),
      (p = t.push('table_close', 'table', -1)),
      (_[1] = u),
      (t.parentType = g),
      (t.line = u),
      !0
    )
  },
  T3 = function (t, n, r) {
    var o, s, i
    if (t.sCount[n] - t.blkIndent < 4) return !1
    for (s = o = n + 1; o < r; ) {
      if (t.isEmpty(o)) {
        o++
        continue
      }
      if (t.sCount[o] - t.blkIndent >= 4) {
        o++, (s = o)
        continue
      }
      break
    }
    return (
      (t.line = s),
      (i = t.push('code_block', 'code', 0)),
      (i.content =
        t.getLines(n, s, 4 + t.blkIndent, !1) +
        `
`),
      (i.map = [n, t.line]),
      !0
    )
  },
  R3 = function (t, n, r, o) {
    var s,
      i,
      c,
      l,
      a,
      u,
      f,
      h = !1,
      p = t.bMarks[n] + t.tShift[n],
      d = t.eMarks[n]
    if (
      t.sCount[n] - t.blkIndent >= 4 ||
      p + 3 > d ||
      ((s = t.src.charCodeAt(p)), s !== 126 && s !== 96) ||
      ((a = p), (p = t.skipChars(p, s)), (i = p - a), i < 3) ||
      ((f = t.src.slice(a, p)), (c = t.src.slice(p, d)), s === 96 && c.indexOf(String.fromCharCode(s)) >= 0)
    )
      return !1
    if (o) return !0
    for (
      l = n;
      l++,
        !(
          l >= r ||
          ((p = a = t.bMarks[l] + t.tShift[l]), (d = t.eMarks[l]), p < d && t.sCount[l] < t.blkIndent)
        );

    )
      if (
        t.src.charCodeAt(p) === s &&
        !(t.sCount[l] - t.blkIndent >= 4) &&
        ((p = t.skipChars(p, s)), !(p - a < i) && ((p = t.skipSpaces(p)), !(p < d)))
      ) {
        h = !0
        break
      }
    return (
      (i = t.sCount[n]),
      (t.line = l + (h ? 1 : 0)),
      (u = t.push('fence', 'code', 0)),
      (u.info = c),
      (u.content = t.getLines(n + 1, l, i, !0)),
      (u.markup = f),
      (u.map = [n, t.line]),
      !0
    )
  },
  Oe = E.isSpace,
  L3 = function (t, n, r, o) {
    var s,
      i,
      c,
      l,
      a,
      u,
      f,
      h,
      p,
      d,
      m,
      _,
      b,
      g,
      x,
      y,
      w,
      k,
      D,
      L,
      Y = t.lineMax,
      C = t.bMarks[n] + t.tShift[n],
      S = t.eMarks[n]
    if (t.sCount[n] - t.blkIndent >= 4 || t.src.charCodeAt(C++) !== 62) return !1
    if (o) return !0
    for (
      l = p = t.sCount[n] + 1,
        t.src.charCodeAt(C) === 32
          ? (C++, l++, p++, (s = !1), (y = !0))
          : t.src.charCodeAt(C) === 9
          ? ((y = !0), (t.bsCount[n] + p) % 4 === 3 ? (C++, l++, p++, (s = !1)) : (s = !0))
          : (y = !1),
        d = [t.bMarks[n]],
        t.bMarks[n] = C;
      C < S && ((i = t.src.charCodeAt(C)), Oe(i));

    ) {
      i === 9 ? (p += 4 - ((p + t.bsCount[n] + (s ? 1 : 0)) % 4)) : p++
      C++
    }
    for (
      m = [t.bsCount[n]],
        t.bsCount[n] = t.sCount[n] + 1 + (y ? 1 : 0),
        u = C >= S,
        g = [t.sCount[n]],
        t.sCount[n] = p - l,
        x = [t.tShift[n]],
        t.tShift[n] = C - t.bMarks[n],
        k = t.md.block.ruler.getRules('blockquote'),
        b = t.parentType,
        t.parentType = 'blockquote',
        h = n + 1;
      h < r &&
      ((L = t.sCount[h] < t.blkIndent), (C = t.bMarks[h] + t.tShift[h]), (S = t.eMarks[h]), !(C >= S));
      h++
    ) {
      if (t.src.charCodeAt(C++) === 62 && !L) {
        for (
          l = p = t.sCount[h] + 1,
            t.src.charCodeAt(C) === 32
              ? (C++, l++, p++, (s = !1), (y = !0))
              : t.src.charCodeAt(C) === 9
              ? ((y = !0), (t.bsCount[h] + p) % 4 === 3 ? (C++, l++, p++, (s = !1)) : (s = !0))
              : (y = !1),
            d.push(t.bMarks[h]),
            t.bMarks[h] = C;
          C < S && ((i = t.src.charCodeAt(C)), Oe(i));

        ) {
          i === 9 ? (p += 4 - ((p + t.bsCount[h] + (s ? 1 : 0)) % 4)) : p++
          C++
        }
        ;(u = C >= S),
          m.push(t.bsCount[h]),
          (t.bsCount[h] = t.sCount[h] + 1 + (y ? 1 : 0)),
          g.push(t.sCount[h]),
          (t.sCount[h] = p - l),
          x.push(t.tShift[h]),
          (t.tShift[h] = C - t.bMarks[h])
        continue
      }
      if (u) break
      for (w = !1, c = 0, a = k.length; c < a; c++)
        if (k[c](t, h, r, !0)) {
          w = !0
          break
        }
      if (w) {
        ;(t.lineMax = h),
          t.blkIndent !== 0 &&
            (d.push(t.bMarks[h]),
            m.push(t.bsCount[h]),
            x.push(t.tShift[h]),
            g.push(t.sCount[h]),
            (t.sCount[h] -= t.blkIndent))
        break
      }
      d.push(t.bMarks[h]), m.push(t.bsCount[h]), x.push(t.tShift[h]), g.push(t.sCount[h]), (t.sCount[h] = -1)
    }
    for (
      _ = t.blkIndent,
        t.blkIndent = 0,
        D = t.push('blockquote_open', 'blockquote', 1),
        D.markup = '>',
        D.map = f = [n, 0],
        t.md.block.tokenize(t, n, h),
        D = t.push('blockquote_close', 'blockquote', -1),
        D.markup = '>',
        t.lineMax = Y,
        t.parentType = b,
        f[1] = t.line,
        c = 0;
      c < x.length;
      c++
    )
      (t.bMarks[c + n] = d[c]), (t.tShift[c + n] = x[c]), (t.sCount[c + n] = g[c]), (t.bsCount[c + n] = m[c])
    return (t.blkIndent = _), !0
  },
  F3 = E.isSpace,
  M3 = function (t, n, r, o) {
    var s,
      i,
      c,
      l,
      a = t.bMarks[n] + t.tShift[n],
      u = t.eMarks[n]
    if (t.sCount[n] - t.blkIndent >= 4 || ((s = t.src.charCodeAt(a++)), s !== 42 && s !== 45 && s !== 95))
      return !1
    for (i = 1; a < u; ) {
      if (((c = t.src.charCodeAt(a++)), c !== s && !F3(c))) return !1
      c === s && i++
    }
    return i < 3
      ? !1
      : (o ||
          ((t.line = n + 1),
          (l = t.push('hr', 'hr', 0)),
          (l.map = [n, t.line]),
          (l.markup = Array(i + 1).join(String.fromCharCode(s)))),
        !0)
  },
  kn = E.isSpace
function He(e, t) {
  var n, r, o, s
  return (
    (r = e.bMarks[t] + e.tShift[t]),
    (o = e.eMarks[t]),
    (n = e.src.charCodeAt(r++)),
    (n !== 42 && n !== 45 && n !== 43) || (r < o && ((s = e.src.charCodeAt(r)), !kn(s))) ? -1 : r
  )
}
function Ue(e, t) {
  var n,
    r = e.bMarks[t] + e.tShift[t],
    o = r,
    s = e.eMarks[t]
  if (o + 1 >= s || ((n = e.src.charCodeAt(o++)), n < 48 || n > 57)) return -1
  for (;;) {
    if (o >= s) return -1
    if (((n = e.src.charCodeAt(o++)), n >= 48 && n <= 57)) {
      if (o - r >= 10) return -1
      continue
    }
    if (n === 41 || n === 46) break
    return -1
  }
  return o < s && ((n = e.src.charCodeAt(o)), !kn(n)) ? -1 : o
}
function I3(e, t) {
  var n,
    r,
    o = e.level + 2
  for (n = t + 2, r = e.tokens.length - 2; n < r; n++)
    e.tokens[n].level === o &&
      e.tokens[n].type === 'paragraph_open' &&
      ((e.tokens[n + 2].hidden = !0), (e.tokens[n].hidden = !0), (n += 2))
}
var z3 = function (t, n, r, o) {
    var s,
      i,
      c,
      l,
      a,
      u,
      f,
      h,
      p,
      d,
      m,
      _,
      b,
      g,
      x,
      y,
      w,
      k,
      D,
      L,
      Y,
      C,
      S,
      rt,
      W,
      v,
      T,
      A,
      U = !1,
      ie = !0
    if (
      t.sCount[n] - t.blkIndent >= 4 ||
      (t.listIndent >= 0 && t.sCount[n] - t.listIndent >= 4 && t.sCount[n] < t.blkIndent)
    )
      return !1
    if ((o && t.parentType === 'paragraph' && t.sCount[n] >= t.blkIndent && (U = !0), (S = Ue(t, n)) >= 0)) {
      if (((f = !0), (W = t.bMarks[n] + t.tShift[n]), (b = Number(t.src.slice(W, S - 1))), U && b !== 1))
        return !1
    } else if ((S = He(t, n)) >= 0) f = !1
    else return !1
    if (U && t.skipSpaces(S) >= t.eMarks[n]) return !1
    if (((_ = t.src.charCodeAt(S - 1)), o)) return !0
    for (
      m = t.tokens.length,
        f
          ? ((A = t.push('ordered_list_open', 'ol', 1)), b !== 1 && (A.attrs = [['start', b]]))
          : (A = t.push('bullet_list_open', 'ul', 1)),
        A.map = d = [n, 0],
        A.markup = String.fromCharCode(_),
        x = n,
        rt = !1,
        T = t.md.block.ruler.getRules('list'),
        k = t.parentType,
        t.parentType = 'list';
      x < r;

    ) {
      for (C = S, g = t.eMarks[x], u = y = t.sCount[x] + S - (t.bMarks[n] + t.tShift[n]); C < g; ) {
        if (((s = t.src.charCodeAt(C)), s === 9)) y += 4 - ((y + t.bsCount[x]) % 4)
        else if (s === 32) y++
        else break
        C++
      }
      if (
        ((i = C),
        i >= g ? (a = 1) : (a = y - u),
        a > 4 && (a = 1),
        (l = u + a),
        (A = t.push('list_item_open', 'li', 1)),
        (A.markup = String.fromCharCode(_)),
        (A.map = h = [n, 0]),
        f && (A.info = t.src.slice(W, S - 1)),
        (Y = t.tight),
        (L = t.tShift[n]),
        (D = t.sCount[n]),
        (w = t.listIndent),
        (t.listIndent = t.blkIndent),
        (t.blkIndent = l),
        (t.tight = !0),
        (t.tShift[n] = i - t.bMarks[n]),
        (t.sCount[n] = y),
        i >= g && t.isEmpty(n + 1) ? (t.line = Math.min(t.line + 2, r)) : t.md.block.tokenize(t, n, r, !0),
        (!t.tight || rt) && (ie = !1),
        (rt = t.line - n > 1 && t.isEmpty(t.line - 1)),
        (t.blkIndent = t.listIndent),
        (t.listIndent = w),
        (t.tShift[n] = L),
        (t.sCount[n] = D),
        (t.tight = Y),
        (A = t.push('list_item_close', 'li', -1)),
        (A.markup = String.fromCharCode(_)),
        (x = n = t.line),
        (h[1] = x),
        (i = t.bMarks[n]),
        x >= r || t.sCount[x] < t.blkIndent || t.sCount[n] - t.blkIndent >= 4)
      )
        break
      for (v = !1, c = 0, p = T.length; c < p; c++)
        if (T[c](t, x, r, !0)) {
          v = !0
          break
        }
      if (v) break
      if (f) {
        if (((S = Ue(t, x)), S < 0)) break
        W = t.bMarks[x] + t.tShift[x]
      } else if (((S = He(t, x)), S < 0)) break
      if (_ !== t.src.charCodeAt(S - 1)) break
    }
    return (
      f ? (A = t.push('ordered_list_close', 'ol', -1)) : (A = t.push('bullet_list_close', 'ul', -1)),
      (A.markup = String.fromCharCode(_)),
      (d[1] = x),
      (t.line = x),
      (t.parentType = k),
      ie && I3(t, m),
      !0
    )
  },
  P3 = E.normalizeReference,
  gt = E.isSpace,
  B3 = function (t, n, r, o) {
    var s,
      i,
      c,
      l,
      a,
      u,
      f,
      h,
      p,
      d,
      m,
      _,
      b,
      g,
      x,
      y,
      w = 0,
      k = t.bMarks[n] + t.tShift[n],
      D = t.eMarks[n],
      L = n + 1
    if (t.sCount[n] - t.blkIndent >= 4 || t.src.charCodeAt(k) !== 91) return !1
    for (; ++k < D; )
      if (t.src.charCodeAt(k) === 93 && t.src.charCodeAt(k - 1) !== 92) {
        if (k + 1 === D || t.src.charCodeAt(k + 1) !== 58) return !1
        break
      }
    for (
      l = t.lineMax, x = t.md.block.ruler.getRules('reference'), d = t.parentType, t.parentType = 'reference';
      L < l && !t.isEmpty(L);
      L++
    )
      if (!(t.sCount[L] - t.blkIndent > 3) && !(t.sCount[L] < 0)) {
        for (g = !1, u = 0, f = x.length; u < f; u++)
          if (x[u](t, L, l, !0)) {
            g = !0
            break
          }
        if (g) break
      }
    for (b = t.getLines(n, L, t.blkIndent, !1).trim(), D = b.length, k = 1; k < D; k++) {
      if (((s = b.charCodeAt(k)), s === 91)) return !1
      if (s === 93) {
        p = k
        break
      } else s === 10 ? w++ : s === 92 && (k++, k < D && b.charCodeAt(k) === 10 && w++)
    }
    if (p < 0 || b.charCodeAt(p + 1) !== 58) return !1
    for (k = p + 2; k < D; k++)
      if (((s = b.charCodeAt(k)), s === 10)) w++
      else if (!gt(s)) break
    if (
      ((m = t.md.helpers.parseLinkDestination(b, k, D)),
      !m.ok || ((a = t.md.normalizeLink(m.str)), !t.md.validateLink(a)))
    )
      return !1
    for (k = m.pos, w += m.lines, i = k, c = w, _ = k; k < D; k++)
      if (((s = b.charCodeAt(k)), s === 10)) w++
      else if (!gt(s)) break
    for (
      m = t.md.helpers.parseLinkTitle(b, k, D),
        k < D && _ !== k && m.ok ? ((y = m.str), (k = m.pos), (w += m.lines)) : ((y = ''), (k = i), (w = c));
      k < D && ((s = b.charCodeAt(k)), !!gt(s));

    )
      k++
    if (k < D && b.charCodeAt(k) !== 10 && y)
      for (y = '', k = i, w = c; k < D && ((s = b.charCodeAt(k)), !!gt(s)); ) k++
    return (k < D && b.charCodeAt(k) !== 10) || ((h = P3(b.slice(1, p))), !h)
      ? !1
      : (o ||
          (typeof t.env.references > 'u' && (t.env.references = {}),
          typeof t.env.references[h] > 'u' && (t.env.references[h] = { title: y, href: a }),
          (t.parentType = d),
          (t.line = n + w + 1)),
        !0)
  },
  N3 = [
    'address',
    'article',
    'aside',
    'base',
    'basefont',
    'blockquote',
    'body',
    'caption',
    'center',
    'col',
    'colgroup',
    'dd',
    'details',
    'dialog',
    'dir',
    'div',
    'dl',
    'dt',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'frame',
    'frameset',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hr',
    'html',
    'iframe',
    'legend',
    'li',
    'link',
    'main',
    'menu',
    'menuitem',
    'nav',
    'noframes',
    'ol',
    'optgroup',
    'option',
    'p',
    'param',
    'section',
    'source',
    'summary',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'title',
    'tr',
    'track',
    'ul',
  ],
  qt = {},
  O3 = '[a-zA-Z_:][a-zA-Z0-9:._-]*',
  H3 = '[^"\'=<>`\\x00-\\x20]+',
  U3 = "'[^']*'",
  j3 = '"[^"]*"',
  V3 = '(?:' + H3 + '|' + U3 + '|' + j3 + ')',
  $3 = '(?:\\s+' + O3 + '(?:\\s*=\\s*' + V3 + ')?)',
  yn = '<[A-Za-z][A-Za-z0-9\\-]*' + $3 + '*\\s*\\/?>',
  wn = '<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>',
  X3 = '<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->',
  Y3 = '<[?][\\s\\S]*?[?]>',
  W3 = '<![A-Z]+\\s+[^>]*>',
  G3 = '<!\\[CDATA\\[[\\s\\S]*?\\]\\]>',
  Z3 = new RegExp('^(?:' + yn + '|' + wn + '|' + X3 + '|' + Y3 + '|' + W3 + '|' + G3 + ')'),
  J3 = new RegExp('^(?:' + yn + '|' + wn + ')')
qt.HTML_TAG_RE = Z3
qt.HTML_OPEN_CLOSE_TAG_RE = J3
var K3 = N3,
  Q3 = qt.HTML_OPEN_CLOSE_TAG_RE,
  G = [
    [/^<(script|pre|style|textarea)(?=(\s|>|$))/i, /<\/(script|pre|style|textarea)>/i, !0],
    [/^<!--/, /-->/, !0],
    [/^<\?/, /\?>/, !0],
    [/^<![A-Z]/, />/, !0],
    [/^<!\[CDATA\[/, /\]\]>/, !0],
    [new RegExp('^</?(' + K3.join('|') + ')(?=(\\s|/?>|$))', 'i'), /^$/, !0],
    [new RegExp(Q3.source + '\\s*$'), /^$/, !1],
  ],
  tO = function (t, n, r, o) {
    var s,
      i,
      c,
      l,
      a = t.bMarks[n] + t.tShift[n],
      u = t.eMarks[n]
    if (t.sCount[n] - t.blkIndent >= 4 || !t.md.options.html || t.src.charCodeAt(a) !== 60) return !1
    for (l = t.src.slice(a, u), s = 0; s < G.length && !G[s][0].test(l); s++);
    if (s === G.length) return !1
    if (o) return G[s][2]
    if (((i = n + 1), !G[s][1].test(l))) {
      for (; i < r && !(t.sCount[i] < t.blkIndent); i++)
        if (((a = t.bMarks[i] + t.tShift[i]), (u = t.eMarks[i]), (l = t.src.slice(a, u)), G[s][1].test(l))) {
          l.length !== 0 && i++
          break
        }
    }
    return (
      (t.line = i),
      (c = t.push('html_block', '', 0)),
      (c.map = [n, i]),
      (c.content = t.getLines(n, i, t.blkIndent, !0)),
      !0
    )
  },
  je = E.isSpace,
  eO = function (t, n, r, o) {
    var s,
      i,
      c,
      l,
      a = t.bMarks[n] + t.tShift[n],
      u = t.eMarks[n]
    if (t.sCount[n] - t.blkIndent >= 4 || ((s = t.src.charCodeAt(a)), s !== 35 || a >= u)) return !1
    for (i = 1, s = t.src.charCodeAt(++a); s === 35 && a < u && i <= 6; ) i++, (s = t.src.charCodeAt(++a))
    return i > 6 || (a < u && !je(s))
      ? !1
      : (o ||
          ((u = t.skipSpacesBack(u, a)),
          (c = t.skipCharsBack(u, 35, a)),
          c > a && je(t.src.charCodeAt(c - 1)) && (u = c),
          (t.line = n + 1),
          (l = t.push('heading_open', 'h' + String(i), 1)),
          (l.markup = '########'.slice(0, i)),
          (l.map = [n, t.line]),
          (l = t.push('inline', '', 0)),
          (l.content = t.src.slice(a, u).trim()),
          (l.map = [n, t.line]),
          (l.children = []),
          (l = t.push('heading_close', 'h' + String(i), -1)),
          (l.markup = '########'.slice(0, i))),
        !0)
  },
  nO = function (t, n, r) {
    var o,
      s,
      i,
      c,
      l,
      a,
      u,
      f,
      h,
      p = n + 1,
      d,
      m = t.md.block.ruler.getRules('paragraph')
    if (t.sCount[n] - t.blkIndent >= 4) return !1
    for (d = t.parentType, t.parentType = 'paragraph'; p < r && !t.isEmpty(p); p++)
      if (!(t.sCount[p] - t.blkIndent > 3)) {
        if (
          t.sCount[p] >= t.blkIndent &&
          ((a = t.bMarks[p] + t.tShift[p]),
          (u = t.eMarks[p]),
          a < u &&
            ((h = t.src.charCodeAt(a)),
            (h === 45 || h === 61) && ((a = t.skipChars(a, h)), (a = t.skipSpaces(a)), a >= u)))
        ) {
          f = h === 61 ? 1 : 2
          break
        }
        if (!(t.sCount[p] < 0)) {
          for (s = !1, i = 0, c = m.length; i < c; i++)
            if (m[i](t, p, r, !0)) {
              s = !0
              break
            }
          if (s) break
        }
      }
    return f
      ? ((o = t.getLines(n, p, t.blkIndent, !1).trim()),
        (t.line = p + 1),
        (l = t.push('heading_open', 'h' + String(f), 1)),
        (l.markup = String.fromCharCode(h)),
        (l.map = [n, t.line]),
        (l = t.push('inline', '', 0)),
        (l.content = o),
        (l.map = [n, t.line - 1]),
        (l.children = []),
        (l = t.push('heading_close', 'h' + String(f), -1)),
        (l.markup = String.fromCharCode(h)),
        (t.parentType = d),
        !0)
      : !1
  },
  rO = function (t, n) {
    var r,
      o,
      s,
      i,
      c,
      l,
      a = n + 1,
      u = t.md.block.ruler.getRules('paragraph'),
      f = t.lineMax
    for (l = t.parentType, t.parentType = 'paragraph'; a < f && !t.isEmpty(a); a++)
      if (!(t.sCount[a] - t.blkIndent > 3) && !(t.sCount[a] < 0)) {
        for (o = !1, s = 0, i = u.length; s < i; s++)
          if (u[s](t, a, f, !0)) {
            o = !0
            break
          }
        if (o) break
      }
    return (
      (r = t.getLines(n, a, t.blkIndent, !1).trim()),
      (t.line = a),
      (c = t.push('paragraph_open', 'p', 1)),
      (c.map = [n, t.line]),
      (c = t.push('inline', '', 0)),
      (c.content = r),
      (c.map = [n, t.line]),
      (c.children = []),
      (c = t.push('paragraph_close', 'p', -1)),
      (t.parentType = l),
      !0
    )
  },
  Cn = re,
  St = E.isSpace
function O(e, t, n, r) {
  var o, s, i, c, l, a, u, f
  for (
    this.src = e,
      this.md = t,
      this.env = n,
      this.tokens = r,
      this.bMarks = [],
      this.eMarks = [],
      this.tShift = [],
      this.sCount = [],
      this.bsCount = [],
      this.blkIndent = 0,
      this.line = 0,
      this.lineMax = 0,
      this.tight = !1,
      this.ddIndent = -1,
      this.listIndent = -1,
      this.parentType = 'root',
      this.level = 0,
      this.result = '',
      s = this.src,
      f = !1,
      i = c = a = u = 0,
      l = s.length;
    c < l;
    c++
  ) {
    if (((o = s.charCodeAt(c)), !f))
      if (St(o)) {
        a++, o === 9 ? (u += 4 - (u % 4)) : u++
        continue
      } else f = !0
    ;(o === 10 || c === l - 1) &&
      (o !== 10 && c++,
      this.bMarks.push(i),
      this.eMarks.push(c),
      this.tShift.push(a),
      this.sCount.push(u),
      this.bsCount.push(0),
      (f = !1),
      (a = 0),
      (u = 0),
      (i = c + 1))
  }
  this.bMarks.push(s.length),
    this.eMarks.push(s.length),
    this.tShift.push(0),
    this.sCount.push(0),
    this.bsCount.push(0),
    (this.lineMax = this.bMarks.length - 1)
}
O.prototype.push = function (e, t, n) {
  var r = new Cn(e, t, n)
  return (
    (r.block = !0),
    n < 0 && this.level--,
    (r.level = this.level),
    n > 0 && this.level++,
    this.tokens.push(r),
    r
  )
}
O.prototype.isEmpty = function (t) {
  return this.bMarks[t] + this.tShift[t] >= this.eMarks[t]
}
O.prototype.skipEmptyLines = function (t) {
  for (var n = this.lineMax; t < n && !(this.bMarks[t] + this.tShift[t] < this.eMarks[t]); t++);
  return t
}
O.prototype.skipSpaces = function (t) {
  for (var n, r = this.src.length; t < r && ((n = this.src.charCodeAt(t)), !!St(n)); t++);
  return t
}
O.prototype.skipSpacesBack = function (t, n) {
  if (t <= n) return t
  for (; t > n; ) if (!St(this.src.charCodeAt(--t))) return t + 1
  return t
}
O.prototype.skipChars = function (t, n) {
  for (var r = this.src.length; t < r && this.src.charCodeAt(t) === n; t++);
  return t
}
O.prototype.skipCharsBack = function (t, n, r) {
  if (t <= r) return t
  for (; t > r; ) if (n !== this.src.charCodeAt(--t)) return t + 1
  return t
}
O.prototype.getLines = function (t, n, r, o) {
  var s,
    i,
    c,
    l,
    a,
    u,
    f,
    h = t
  if (t >= n) return ''
  for (u = new Array(n - t), s = 0; h < n; h++, s++) {
    for (
      i = 0, f = l = this.bMarks[h], h + 1 < n || o ? (a = this.eMarks[h] + 1) : (a = this.eMarks[h]);
      l < a && i < r;

    ) {
      if (((c = this.src.charCodeAt(l)), St(c))) c === 9 ? (i += 4 - ((i + this.bsCount[h]) % 4)) : i++
      else if (l - f < this.tShift[h]) i++
      else break
      l++
    }
    i > r ? (u[s] = new Array(i - r + 1).join(' ') + this.src.slice(l, a)) : (u[s] = this.src.slice(l, a))
  }
  return u.join('')
}
O.prototype.Token = Cn
var oO = O,
  sO = ne,
  mt = [
    ['table', S3, ['paragraph', 'reference']],
    ['code', T3],
    ['fence', R3, ['paragraph', 'reference', 'blockquote', 'list']],
    ['blockquote', L3, ['paragraph', 'reference', 'blockquote', 'list']],
    ['hr', M3, ['paragraph', 'reference', 'blockquote', 'list']],
    ['list', z3, ['paragraph', 'reference', 'blockquote']],
    ['reference', B3],
    ['html_block', tO, ['paragraph', 'reference', 'blockquote']],
    ['heading', eO, ['paragraph', 'reference', 'blockquote']],
    ['lheading', nO],
    ['paragraph', rO],
  ]
function Tt() {
  this.ruler = new sO()
  for (var e = 0; e < mt.length; e++) this.ruler.push(mt[e][0], mt[e][1], { alt: (mt[e][2] || []).slice() })
}
Tt.prototype.tokenize = function (e, t, n) {
  for (
    var r, o, s = this.ruler.getRules(''), i = s.length, c = t, l = !1, a = e.md.options.maxNesting;
    c < n && ((e.line = c = e.skipEmptyLines(c)), !(c >= n || e.sCount[c] < e.blkIndent));

  ) {
    if (e.level >= a) {
      e.line = n
      break
    }
    for (o = 0; o < i && ((r = s[o](e, c, n, !1)), !r); o++);
    ;(e.tight = !l),
      e.isEmpty(e.line - 1) && (l = !0),
      (c = e.line),
      c < n && e.isEmpty(c) && ((l = !0), c++, (e.line = c))
  }
}
Tt.prototype.parse = function (e, t, n, r) {
  var o
  !e || ((o = new this.State(e, t, n, r)), this.tokenize(o, o.line, o.lineMax))
}
Tt.prototype.State = oO
var cO = Tt
function iO(e) {
  switch (e) {
    case 10:
    case 33:
    case 35:
    case 36:
    case 37:
    case 38:
    case 42:
    case 43:
    case 45:
    case 58:
    case 60:
    case 61:
    case 62:
    case 64:
    case 91:
    case 92:
    case 93:
    case 94:
    case 95:
    case 96:
    case 123:
    case 125:
    case 126:
      return !0
    default:
      return !1
  }
}
var lO = function (t, n) {
    for (var r = t.pos; r < t.posMax && !iO(t.src.charCodeAt(r)); ) r++
    return r === t.pos ? !1 : (n || (t.pending += t.src.slice(t.pos, r)), (t.pos = r), !0)
  },
  aO = /(?:^|[^a-z0-9.+-])([a-z][a-z0-9.+-]*)$/i,
  uO = function (t, n) {
    var r, o, s, i, c, l, a, u
    return !t.md.options.linkify ||
      t.linkLevel > 0 ||
      ((r = t.pos), (o = t.posMax), r + 3 > o) ||
      t.src.charCodeAt(r) !== 58 ||
      t.src.charCodeAt(r + 1) !== 47 ||
      t.src.charCodeAt(r + 2) !== 47 ||
      ((s = t.pending.match(aO)), !s) ||
      ((i = s[1]), (c = t.md.linkify.matchAtStart(t.src.slice(r - i.length))), !c) ||
      ((l = c.url), (l = l.replace(/\*+$/, '')), (a = t.md.normalizeLink(l)), !t.md.validateLink(a))
      ? !1
      : (n ||
          ((t.pending = t.pending.slice(0, -i.length)),
          (u = t.push('link_open', 'a', 1)),
          (u.attrs = [['href', a]]),
          (u.markup = 'linkify'),
          (u.info = 'auto'),
          (u = t.push('text', '', 0)),
          (u.content = t.md.normalizeLinkText(l)),
          (u = t.push('link_close', 'a', -1)),
          (u.markup = 'linkify'),
          (u.info = 'auto')),
        (t.pos += l.length - i.length),
        !0)
  },
  fO = E.isSpace,
  pO = function (t, n) {
    var r,
      o,
      s,
      i = t.pos
    if (t.src.charCodeAt(i) !== 10) return !1
    if (((r = t.pending.length - 1), (o = t.posMax), !n))
      if (r >= 0 && t.pending.charCodeAt(r) === 32)
        if (r >= 1 && t.pending.charCodeAt(r - 1) === 32) {
          for (s = r - 1; s >= 1 && t.pending.charCodeAt(s - 1) === 32; ) s--
          ;(t.pending = t.pending.slice(0, s)), t.push('hardbreak', 'br', 0)
        } else (t.pending = t.pending.slice(0, -1)), t.push('softbreak', 'br', 0)
      else t.push('softbreak', 'br', 0)
    for (i++; i < o && fO(t.src.charCodeAt(i)); ) i++
    return (t.pos = i), !0
  },
  hO = E.isSpace,
  se = []
for (var Ve = 0; Ve < 256; Ve++) se.push(0)
'\\!"#$%&\'()*+,./:;<=>?@[]^_`{|}~-'.split('').forEach(function (e) {
  se[e.charCodeAt(0)] = 1
})
var dO = function (t, n) {
    var r,
      o,
      s,
      i,
      c,
      l = t.pos,
      a = t.posMax
    if (t.src.charCodeAt(l) !== 92 || (l++, l >= a)) return !1
    if (((r = t.src.charCodeAt(l)), r === 10)) {
      for (n || t.push('hardbreak', 'br', 0), l++; l < a && ((r = t.src.charCodeAt(l)), !!hO(r)); ) l++
      return (t.pos = l), !0
    }
    return (
      (i = t.src[l]),
      r >= 55296 &&
        r <= 56319 &&
        l + 1 < a &&
        ((o = t.src.charCodeAt(l + 1)), o >= 56320 && o <= 57343 && ((i += t.src[l + 1]), l++)),
      (s = '\\' + i),
      n ||
        ((c = t.push('text_special', '', 0)),
        r < 256 && se[r] !== 0 ? (c.content = i) : (c.content = s),
        (c.markup = s),
        (c.info = 'escape')),
      (t.pos = l + 1),
      !0
    )
  },
  gO = function (t, n) {
    var r,
      o,
      s,
      i,
      c,
      l,
      a,
      u,
      f = t.pos,
      h = t.src.charCodeAt(f)
    if (h !== 96) return !1
    for (r = f, f++, o = t.posMax; f < o && t.src.charCodeAt(f) === 96; ) f++
    if (((s = t.src.slice(r, f)), (a = s.length), t.backticksScanned && (t.backticks[a] || 0) <= r))
      return n || (t.pending += s), (t.pos += a), !0
    for (c = l = f; (c = t.src.indexOf('`', l)) !== -1; ) {
      for (l = c + 1; l < o && t.src.charCodeAt(l) === 96; ) l++
      if (((u = l - c), u === a))
        return (
          n ||
            ((i = t.push('code_inline', 'code', 0)),
            (i.markup = s),
            (i.content = t.src
              .slice(f, c)
              .replace(/\n/g, ' ')
              .replace(/^ (.+) $/, '$1'))),
          (t.pos = l),
          !0
        )
      t.backticks[u] = c
    }
    return (t.backticksScanned = !0), n || (t.pending += s), (t.pos += a), !0
  },
  Rt = {}
Rt.tokenize = function (t, n) {
  var r,
    o,
    s,
    i,
    c,
    l = t.pos,
    a = t.src.charCodeAt(l)
  if (n || a !== 126 || ((o = t.scanDelims(t.pos, !0)), (i = o.length), (c = String.fromCharCode(a)), i < 2))
    return !1
  for (i % 2 && ((s = t.push('text', '', 0)), (s.content = c), i--), r = 0; r < i; r += 2)
    (s = t.push('text', '', 0)),
      (s.content = c + c),
      t.delimiters.push({
        marker: a,
        length: 0,
        token: t.tokens.length - 1,
        end: -1,
        open: o.can_open,
        close: o.can_close,
      })
  return (t.pos += o.length), !0
}
function $e(e, t) {
  var n,
    r,
    o,
    s,
    i,
    c = [],
    l = t.length
  for (n = 0; n < l; n++)
    (o = t[n]),
      o.marker === 126 &&
        o.end !== -1 &&
        ((s = t[o.end]),
        (i = e.tokens[o.token]),
        (i.type = 's_open'),
        (i.tag = 's'),
        (i.nesting = 1),
        (i.markup = '~~'),
        (i.content = ''),
        (i = e.tokens[s.token]),
        (i.type = 's_close'),
        (i.tag = 's'),
        (i.nesting = -1),
        (i.markup = '~~'),
        (i.content = ''),
        e.tokens[s.token - 1].type === 'text' && e.tokens[s.token - 1].content === '~' && c.push(s.token - 1))
  for (; c.length; ) {
    for (n = c.pop(), r = n + 1; r < e.tokens.length && e.tokens[r].type === 's_close'; ) r++
    r--, n !== r && ((i = e.tokens[r]), (e.tokens[r] = e.tokens[n]), (e.tokens[n] = i))
  }
}
Rt.postProcess = function (t) {
  var n,
    r = t.tokens_meta,
    o = t.tokens_meta.length
  for ($e(t, t.delimiters), n = 0; n < o; n++) r[n] && r[n].delimiters && $e(t, r[n].delimiters)
}
var Lt = {}
Lt.tokenize = function (t, n) {
  var r,
    o,
    s,
    i = t.pos,
    c = t.src.charCodeAt(i)
  if (n || (c !== 95 && c !== 42)) return !1
  for (o = t.scanDelims(t.pos, c === 42), r = 0; r < o.length; r++)
    (s = t.push('text', '', 0)),
      (s.content = String.fromCharCode(c)),
      t.delimiters.push({
        marker: c,
        length: o.length,
        token: t.tokens.length - 1,
        end: -1,
        open: o.can_open,
        close: o.can_close,
      })
  return (t.pos += o.length), !0
}
function Xe(e, t) {
  var n,
    r,
    o,
    s,
    i,
    c,
    l = t.length
  for (n = l - 1; n >= 0; n--)
    (r = t[n]),
      !(r.marker !== 95 && r.marker !== 42) &&
        r.end !== -1 &&
        ((o = t[r.end]),
        (c =
          n > 0 &&
          t[n - 1].end === r.end + 1 &&
          t[n - 1].marker === r.marker &&
          t[n - 1].token === r.token - 1 &&
          t[r.end + 1].token === o.token + 1),
        (i = String.fromCharCode(r.marker)),
        (s = e.tokens[r.token]),
        (s.type = c ? 'strong_open' : 'em_open'),
        (s.tag = c ? 'strong' : 'em'),
        (s.nesting = 1),
        (s.markup = c ? i + i : i),
        (s.content = ''),
        (s = e.tokens[o.token]),
        (s.type = c ? 'strong_close' : 'em_close'),
        (s.tag = c ? 'strong' : 'em'),
        (s.nesting = -1),
        (s.markup = c ? i + i : i),
        (s.content = ''),
        c && ((e.tokens[t[n - 1].token].content = ''), (e.tokens[t[r.end + 1].token].content = ''), n--))
}
Lt.postProcess = function (t) {
  var n,
    r = t.tokens_meta,
    o = t.tokens_meta.length
  for (Xe(t, t.delimiters), n = 0; n < o; n++) r[n] && r[n].delimiters && Xe(t, r[n].delimiters)
}
var mO = E.normalizeReference,
  Ht = E.isSpace,
  bO = function (t, n) {
    var r,
      o,
      s,
      i,
      c,
      l,
      a,
      u,
      f,
      h = '',
      p = '',
      d = t.pos,
      m = t.posMax,
      _ = t.pos,
      b = !0
    if (
      t.src.charCodeAt(t.pos) !== 91 ||
      ((c = t.pos + 1), (i = t.md.helpers.parseLinkLabel(t, t.pos, !0)), i < 0)
    )
      return !1
    if (((l = i + 1), l < m && t.src.charCodeAt(l) === 40)) {
      for (b = !1, l++; l < m && ((o = t.src.charCodeAt(l)), !(!Ht(o) && o !== 10)); l++);
      if (l >= m) return !1
      if (((_ = l), (a = t.md.helpers.parseLinkDestination(t.src, l, t.posMax)), a.ok)) {
        for (
          h = t.md.normalizeLink(a.str), t.md.validateLink(h) ? (l = a.pos) : (h = ''), _ = l;
          l < m && ((o = t.src.charCodeAt(l)), !(!Ht(o) && o !== 10));
          l++
        );
        if (((a = t.md.helpers.parseLinkTitle(t.src, l, t.posMax)), l < m && _ !== l && a.ok))
          for (p = a.str, l = a.pos; l < m && ((o = t.src.charCodeAt(l)), !(!Ht(o) && o !== 10)); l++);
      }
      ;(l >= m || t.src.charCodeAt(l) !== 41) && (b = !0), l++
    }
    if (b) {
      if (typeof t.env.references > 'u') return !1
      if (
        (l < m && t.src.charCodeAt(l) === 91
          ? ((_ = l + 1),
            (l = t.md.helpers.parseLinkLabel(t, l)),
            l >= 0 ? (s = t.src.slice(_, l++)) : (l = i + 1))
          : (l = i + 1),
        s || (s = t.src.slice(c, i)),
        (u = t.env.references[mO(s)]),
        !u)
      )
        return (t.pos = d), !1
      ;(h = u.href), (p = u.title)
    }
    return (
      n ||
        ((t.pos = c),
        (t.posMax = i),
        (f = t.push('link_open', 'a', 1)),
        (f.attrs = r = [['href', h]]),
        p && r.push(['title', p]),
        t.linkLevel++,
        t.md.inline.tokenize(t),
        t.linkLevel--,
        (f = t.push('link_close', 'a', -1))),
      (t.pos = l),
      (t.posMax = m),
      !0
    )
  },
  vO = E.normalizeReference,
  Ut = E.isSpace,
  _O = function (t, n) {
    var r,
      o,
      s,
      i,
      c,
      l,
      a,
      u,
      f,
      h,
      p,
      d,
      m,
      _ = '',
      b = t.pos,
      g = t.posMax
    if (
      t.src.charCodeAt(t.pos) !== 33 ||
      t.src.charCodeAt(t.pos + 1) !== 91 ||
      ((l = t.pos + 2), (c = t.md.helpers.parseLinkLabel(t, t.pos + 1, !1)), c < 0)
    )
      return !1
    if (((a = c + 1), a < g && t.src.charCodeAt(a) === 40)) {
      for (a++; a < g && ((o = t.src.charCodeAt(a)), !(!Ut(o) && o !== 10)); a++);
      if (a >= g) return !1
      for (
        m = a,
          f = t.md.helpers.parseLinkDestination(t.src, a, t.posMax),
          f.ok && ((_ = t.md.normalizeLink(f.str)), t.md.validateLink(_) ? (a = f.pos) : (_ = '')),
          m = a;
        a < g && ((o = t.src.charCodeAt(a)), !(!Ut(o) && o !== 10));
        a++
      );
      if (((f = t.md.helpers.parseLinkTitle(t.src, a, t.posMax)), a < g && m !== a && f.ok))
        for (h = f.str, a = f.pos; a < g && ((o = t.src.charCodeAt(a)), !(!Ut(o) && o !== 10)); a++);
      else h = ''
      if (a >= g || t.src.charCodeAt(a) !== 41) return (t.pos = b), !1
      a++
    } else {
      if (typeof t.env.references > 'u') return !1
      if (
        (a < g && t.src.charCodeAt(a) === 91
          ? ((m = a + 1),
            (a = t.md.helpers.parseLinkLabel(t, a)),
            a >= 0 ? (i = t.src.slice(m, a++)) : (a = c + 1))
          : (a = c + 1),
        i || (i = t.src.slice(l, c)),
        (u = t.env.references[vO(i)]),
        !u)
      )
        return (t.pos = b), !1
      ;(_ = u.href), (h = u.title)
    }
    return (
      n ||
        ((s = t.src.slice(l, c)),
        t.md.inline.parse(s, t.md, t.env, (d = [])),
        (p = t.push('image', 'img', 0)),
        (p.attrs = r =
          [
            ['src', _],
            ['alt', ''],
          ]),
        (p.children = d),
        (p.content = s),
        h && r.push(['title', h])),
      (t.pos = a),
      (t.posMax = g),
      !0
    )
  },
  xO =
    /^([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/,
  kO = /^([a-zA-Z][a-zA-Z0-9+.\-]{1,31}):([^<>\x00-\x20]*)$/,
  yO = function (t, n) {
    var r,
      o,
      s,
      i,
      c,
      l,
      a = t.pos
    if (t.src.charCodeAt(a) !== 60) return !1
    for (c = t.pos, l = t.posMax; ; ) {
      if (++a >= l || ((i = t.src.charCodeAt(a)), i === 60)) return !1
      if (i === 62) break
    }
    return (
      (r = t.src.slice(c + 1, a)),
      kO.test(r)
        ? ((o = t.md.normalizeLink(r)),
          t.md.validateLink(o)
            ? (n ||
                ((s = t.push('link_open', 'a', 1)),
                (s.attrs = [['href', o]]),
                (s.markup = 'autolink'),
                (s.info = 'auto'),
                (s = t.push('text', '', 0)),
                (s.content = t.md.normalizeLinkText(r)),
                (s = t.push('link_close', 'a', -1)),
                (s.markup = 'autolink'),
                (s.info = 'auto')),
              (t.pos += r.length + 2),
              !0)
            : !1)
        : xO.test(r)
        ? ((o = t.md.normalizeLink('mailto:' + r)),
          t.md.validateLink(o)
            ? (n ||
                ((s = t.push('link_open', 'a', 1)),
                (s.attrs = [['href', o]]),
                (s.markup = 'autolink'),
                (s.info = 'auto'),
                (s = t.push('text', '', 0)),
                (s.content = t.md.normalizeLinkText(r)),
                (s = t.push('link_close', 'a', -1)),
                (s.markup = 'autolink'),
                (s.info = 'auto')),
              (t.pos += r.length + 2),
              !0)
            : !1)
        : !1
    )
  },
  wO = qt.HTML_TAG_RE
function CO(e) {
  return /^<a[>\s]/i.test(e)
}
function AO(e) {
  return /^<\/a\s*>/i.test(e)
}
function EO(e) {
  var t = e | 32
  return t >= 97 && t <= 122
}
var DO = function (t, n) {
    var r,
      o,
      s,
      i,
      c = t.pos
    return !t.md.options.html ||
      ((s = t.posMax), t.src.charCodeAt(c) !== 60 || c + 2 >= s) ||
      ((r = t.src.charCodeAt(c + 1)), r !== 33 && r !== 63 && r !== 47 && !EO(r)) ||
      ((o = t.src.slice(c).match(wO)), !o)
      ? !1
      : (n ||
          ((i = t.push('html_inline', '', 0)),
          (i.content = t.src.slice(c, c + o[0].length)),
          CO(i.content) && t.linkLevel++,
          AO(i.content) && t.linkLevel--),
        (t.pos += o[0].length),
        !0)
  },
  Ye = te.exports,
  qO = E.has,
  SO = E.isValidEntityCode,
  We = E.fromCodePoint,
  TO = /^&#((?:x[a-f0-9]{1,6}|[0-9]{1,7}));/i,
  RO = /^&([a-z][a-z0-9]{1,31});/i,
  LO = function (t, n) {
    var r,
      o,
      s,
      i,
      c = t.pos,
      l = t.posMax
    if (t.src.charCodeAt(c) !== 38 || c + 1 >= l) return !1
    if (((r = t.src.charCodeAt(c + 1)), r === 35)) {
      if (((s = t.src.slice(c).match(TO)), s))
        return (
          n ||
            ((o = s[1][0].toLowerCase() === 'x' ? parseInt(s[1].slice(1), 16) : parseInt(s[1], 10)),
            (i = t.push('text_special', '', 0)),
            (i.content = SO(o) ? We(o) : We(65533)),
            (i.markup = s[0]),
            (i.info = 'entity')),
          (t.pos += s[0].length),
          !0
        )
    } else if (((s = t.src.slice(c).match(RO)), s && qO(Ye, s[1])))
      return (
        n ||
          ((i = t.push('text_special', '', 0)),
          (i.content = Ye[s[1]]),
          (i.markup = s[0]),
          (i.info = 'entity')),
        (t.pos += s[0].length),
        !0
      )
    return !1
  }
function Ge(e, t) {
  var n,
    r,
    o,
    s,
    i,
    c,
    l,
    a,
    u = {},
    f = t.length
  if (!!f) {
    var h = 0,
      p = -2,
      d = []
    for (n = 0; n < f; n++)
      if (
        ((o = t[n]),
        d.push(0),
        (t[h].marker !== o.marker || p !== o.token - 1) && (h = n),
        (p = o.token),
        (o.length = o.length || 0),
        !!o.close)
      ) {
        for (
          u.hasOwnProperty(o.marker) || (u[o.marker] = [-1, -1, -1, -1, -1, -1]),
            i = u[o.marker][(o.open ? 3 : 0) + (o.length % 3)],
            r = h - d[h] - 1,
            c = r;
          r > i;
          r -= d[r] + 1
        )
          if (
            ((s = t[r]),
            s.marker === o.marker &&
              s.open &&
              s.end < 0 &&
              ((l = !1),
              (s.close || o.open) &&
                (s.length + o.length) % 3 === 0 &&
                (s.length % 3 !== 0 || o.length % 3 !== 0) &&
                (l = !0),
              !l))
          ) {
            ;(a = r > 0 && !t[r - 1].open ? d[r - 1] + 1 : 0),
              (d[n] = n - r + a),
              (d[r] = a),
              (o.open = !1),
              (s.end = n),
              (s.close = !1),
              (c = -1),
              (p = -2)
            break
          }
        c !== -1 && (u[o.marker][(o.open ? 3 : 0) + ((o.length || 0) % 3)] = c)
      }
  }
}
var FO = function (t) {
    var n,
      r = t.tokens_meta,
      o = t.tokens_meta.length
    for (Ge(t, t.delimiters), n = 0; n < o; n++) r[n] && r[n].delimiters && Ge(t, r[n].delimiters)
  },
  MO = function (t) {
    var n,
      r,
      o = 0,
      s = t.tokens,
      i = t.tokens.length
    for (n = r = 0; n < i; n++)
      s[n].nesting < 0 && o--,
        (s[n].level = o),
        s[n].nesting > 0 && o++,
        s[n].type === 'text' && n + 1 < i && s[n + 1].type === 'text'
          ? (s[n + 1].content = s[n].content + s[n + 1].content)
          : (n !== r && (s[r] = s[n]), r++)
    n !== r && (s.length = r)
  },
  ce = re,
  Ze = E.isWhiteSpace,
  Je = E.isPunctChar,
  Ke = E.isMdAsciiPunct
function lt(e, t, n, r) {
  ;(this.src = e),
    (this.env = n),
    (this.md = t),
    (this.tokens = r),
    (this.tokens_meta = Array(r.length)),
    (this.pos = 0),
    (this.posMax = this.src.length),
    (this.level = 0),
    (this.pending = ''),
    (this.pendingLevel = 0),
    (this.cache = {}),
    (this.delimiters = []),
    (this._prev_delimiters = []),
    (this.backticks = {}),
    (this.backticksScanned = !1),
    (this.linkLevel = 0)
}
lt.prototype.pushPending = function () {
  var e = new ce('text', '', 0)
  return (
    (e.content = this.pending), (e.level = this.pendingLevel), this.tokens.push(e), (this.pending = ''), e
  )
}
lt.prototype.push = function (e, t, n) {
  this.pending && this.pushPending()
  var r = new ce(e, t, n),
    o = null
  return (
    n < 0 && (this.level--, (this.delimiters = this._prev_delimiters.pop())),
    (r.level = this.level),
    n > 0 &&
      (this.level++,
      this._prev_delimiters.push(this.delimiters),
      (this.delimiters = []),
      (o = { delimiters: this.delimiters })),
    (this.pendingLevel = this.level),
    this.tokens.push(r),
    this.tokens_meta.push(o),
    r
  )
}
lt.prototype.scanDelims = function (e, t) {
  var n = e,
    r,
    o,
    s,
    i,
    c,
    l,
    a,
    u,
    f,
    h = !0,
    p = !0,
    d = this.posMax,
    m = this.src.charCodeAt(e)
  for (r = e > 0 ? this.src.charCodeAt(e - 1) : 32; n < d && this.src.charCodeAt(n) === m; ) n++
  return (
    (s = n - e),
    (o = n < d ? this.src.charCodeAt(n) : 32),
    (a = Ke(r) || Je(String.fromCharCode(r))),
    (f = Ke(o) || Je(String.fromCharCode(o))),
    (l = Ze(r)),
    (u = Ze(o)),
    u ? (h = !1) : f && (l || a || (h = !1)),
    l ? (p = !1) : a && (u || f || (p = !1)),
    t ? ((i = h), (c = p)) : ((i = h && (!p || a)), (c = p && (!h || f))),
    { can_open: i, can_close: c, length: s }
  )
}
lt.prototype.Token = ce
var IO = lt,
  Qe = ne,
  jt = [
    ['text', lO],
    ['linkify', uO],
    ['newline', pO],
    ['escape', dO],
    ['backticks', gO],
    ['strikethrough', Rt.tokenize],
    ['emphasis', Lt.tokenize],
    ['link', bO],
    ['image', _O],
    ['autolink', yO],
    ['html_inline', DO],
    ['entity', LO],
  ],
  Vt = [
    ['balance_pairs', FO],
    ['strikethrough', Rt.postProcess],
    ['emphasis', Lt.postProcess],
    ['fragments_join', MO],
  ]
function at() {
  var e
  for (this.ruler = new Qe(), e = 0; e < jt.length; e++) this.ruler.push(jt[e][0], jt[e][1])
  for (this.ruler2 = new Qe(), e = 0; e < Vt.length; e++) this.ruler2.push(Vt[e][0], Vt[e][1])
}
at.prototype.skipToken = function (e) {
  var t,
    n,
    r = e.pos,
    o = this.ruler.getRules(''),
    s = o.length,
    i = e.md.options.maxNesting,
    c = e.cache
  if (typeof c[r] < 'u') {
    e.pos = c[r]
    return
  }
  if (e.level < i) for (n = 0; n < s && (e.level++, (t = o[n](e, !0)), e.level--, !t); n++);
  else e.pos = e.posMax
  t || e.pos++, (c[r] = e.pos)
}
at.prototype.tokenize = function (e) {
  for (
    var t, n, r = this.ruler.getRules(''), o = r.length, s = e.posMax, i = e.md.options.maxNesting;
    e.pos < s;

  ) {
    if (e.level < i) for (n = 0; n < o && ((t = r[n](e, !1)), !t); n++);
    if (t) {
      if (e.pos >= s) break
      continue
    }
    e.pending += e.src[e.pos++]
  }
  e.pending && e.pushPending()
}
at.prototype.parse = function (e, t, n, r) {
  var o,
    s,
    i,
    c = new this.State(e, t, n, r)
  for (this.tokenize(c), s = this.ruler2.getRules(''), i = s.length, o = 0; o < i; o++) s[o](c)
}
at.prototype.State = IO
var zO = at,
  $t,
  tn
function PO() {
  return (
    tn ||
      ((tn = 1),
      ($t = function (e) {
        var t = {}
        ;(e = e || {}),
          (t.src_Any = mn().source),
          (t.src_Cc = bn().source),
          (t.src_Z = vn().source),
          (t.src_P = ee.source),
          (t.src_ZPCc = [t.src_Z, t.src_P, t.src_Cc].join('|')),
          (t.src_ZCc = [t.src_Z, t.src_Cc].join('|'))
        var n = '[><\uFF5C]'
        return (
          (t.src_pseudo_letter = '(?:(?!' + n + '|' + t.src_ZPCc + ')' + t.src_Any + ')'),
          (t.src_ip4 =
            '(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)'),
          (t.src_auth = '(?:(?:(?!' + t.src_ZCc + '|[@/\\[\\]()]).)+@)?'),
          (t.src_port = '(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?'),
          (t.src_host_terminator =
            '(?=$|' +
            n +
            '|' +
            t.src_ZPCc +
            ')(?!' +
            (e['---'] ? '-(?!--)|' : '-|') +
            '_|:\\d|\\.-|\\.(?!$|' +
            t.src_ZPCc +
            '))'),
          (t.src_path =
            '(?:[/?#](?:(?!' +
            t.src_ZCc +
            '|' +
            n +
            `|[()[\\]{}.,"'?!\\-;]).|\\[(?:(?!` +
            t.src_ZCc +
            '|\\]).)*\\]|\\((?:(?!' +
            t.src_ZCc +
            '|[)]).)*\\)|\\{(?:(?!' +
            t.src_ZCc +
            '|[}]).)*\\}|\\"(?:(?!' +
            t.src_ZCc +
            `|["]).)+\\"|\\'(?:(?!` +
            t.src_ZCc +
            "|[']).)+\\'|\\'(?=" +
            t.src_pseudo_letter +
            '|[-])|\\.{2,}[a-zA-Z0-9%/&]|\\.(?!' +
            t.src_ZCc +
            '|[.]|$)|' +
            (e['---'] ? '\\-(?!--(?:[^-]|$))(?:-*)|' : '\\-+|') +
            ',(?!' +
            t.src_ZCc +
            '|$)|;(?!' +
            t.src_ZCc +
            '|$)|\\!+(?!' +
            t.src_ZCc +
            '|[!]|$)|\\?(?!' +
            t.src_ZCc +
            '|[?]|$))+|\\/)?'),
          (t.src_email_name = '[\\-;:&=\\+\\$,\\.a-zA-Z0-9_][\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]*'),
          (t.src_xn = 'xn--[a-z0-9\\-]{1,59}'),
          (t.src_domain_root = '(?:' + t.src_xn + '|' + t.src_pseudo_letter + '{1,63})'),
          (t.src_domain =
            '(?:' +
            t.src_xn +
            '|(?:' +
            t.src_pseudo_letter +
            ')|(?:' +
            t.src_pseudo_letter +
            '(?:-|' +
            t.src_pseudo_letter +
            '){0,61}' +
            t.src_pseudo_letter +
            '))'),
          (t.src_host = '(?:(?:(?:(?:' + t.src_domain + ')\\.)*' + t.src_domain + '))'),
          (t.tpl_host_fuzzy = '(?:' + t.src_ip4 + '|(?:(?:(?:' + t.src_domain + ')\\.)+(?:%TLDS%)))'),
          (t.tpl_host_no_ip_fuzzy = '(?:(?:(?:' + t.src_domain + ')\\.)+(?:%TLDS%))'),
          (t.src_host_strict = t.src_host + t.src_host_terminator),
          (t.tpl_host_fuzzy_strict = t.tpl_host_fuzzy + t.src_host_terminator),
          (t.src_host_port_strict = t.src_host + t.src_port + t.src_host_terminator),
          (t.tpl_host_port_fuzzy_strict = t.tpl_host_fuzzy + t.src_port + t.src_host_terminator),
          (t.tpl_host_port_no_ip_fuzzy_strict = t.tpl_host_no_ip_fuzzy + t.src_port + t.src_host_terminator),
          (t.tpl_host_fuzzy_test =
            'localhost|www\\.|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:' + t.src_ZPCc + '|>|$))'),
          (t.tpl_email_fuzzy =
            '(^|' +
            n +
            '|"|\\(|' +
            t.src_ZCc +
            ')(' +
            t.src_email_name +
            '@' +
            t.tpl_host_fuzzy_strict +
            ')'),
          (t.tpl_link_fuzzy =
            '(^|(?![.:/\\-_@])(?:[$+<=>^`|\uFF5C]|' +
            t.src_ZPCc +
            '))((?![$+<=>^`|\uFF5C])' +
            t.tpl_host_port_fuzzy_strict +
            t.src_path +
            ')'),
          (t.tpl_link_no_ip_fuzzy =
            '(^|(?![.:/\\-_@])(?:[$+<=>^`|\uFF5C]|' +
            t.src_ZPCc +
            '))((?![$+<=>^`|\uFF5C])' +
            t.tpl_host_port_no_ip_fuzzy_strict +
            t.src_path +
            ')'),
          t
        )
      })),
    $t
  )
}
function Yt(e) {
  var t = Array.prototype.slice.call(arguments, 1)
  return (
    t.forEach(function (n) {
      !n ||
        Object.keys(n).forEach(function (r) {
          e[r] = n[r]
        })
    }),
    e
  )
}
function Ft(e) {
  return Object.prototype.toString.call(e)
}
function BO(e) {
  return Ft(e) === '[object String]'
}
function NO(e) {
  return Ft(e) === '[object Object]'
}
function OO(e) {
  return Ft(e) === '[object RegExp]'
}
function en(e) {
  return Ft(e) === '[object Function]'
}
function HO(e) {
  return e.replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&')
}
var An = { fuzzyLink: !0, fuzzyEmail: !0, fuzzyIP: !1 }
function UO(e) {
  return Object.keys(e || {}).reduce(function (t, n) {
    return t || An.hasOwnProperty(n)
  }, !1)
}
var jO = {
    'http:': {
      validate: function (e, t, n) {
        var r = e.slice(t)
        return (
          n.re.http ||
            (n.re.http = new RegExp(
              '^\\/\\/' + n.re.src_auth + n.re.src_host_port_strict + n.re.src_path,
              'i',
            )),
          n.re.http.test(r) ? r.match(n.re.http)[0].length : 0
        )
      },
    },
    'https:': 'http:',
    'ftp:': 'http:',
    '//': {
      validate: function (e, t, n) {
        var r = e.slice(t)
        return (
          n.re.no_http ||
            (n.re.no_http = new RegExp(
              '^' +
                n.re.src_auth +
                '(?:localhost|(?:(?:' +
                n.re.src_domain +
                ')\\.)+' +
                n.re.src_domain_root +
                ')' +
                n.re.src_port +
                n.re.src_host_terminator +
                n.re.src_path,
              'i',
            )),
          n.re.no_http.test(r)
            ? (t >= 3 && e[t - 3] === ':') || (t >= 3 && e[t - 3] === '/')
              ? 0
              : r.match(n.re.no_http)[0].length
            : 0
        )
      },
    },
    'mailto:': {
      validate: function (e, t, n) {
        var r = e.slice(t)
        return (
          n.re.mailto ||
            (n.re.mailto = new RegExp('^' + n.re.src_email_name + '@' + n.re.src_host_strict, 'i')),
          n.re.mailto.test(r) ? r.match(n.re.mailto)[0].length : 0
        )
      },
    },
  },
  VO =
    'a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]',
  $O = 'biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|\u0440\u0444'.split('|')
function XO(e) {
  ;(e.__index__ = -1), (e.__text_cache__ = '')
}
function YO(e) {
  return function (t, n) {
    var r = t.slice(n)
    return e.test(r) ? r.match(e)[0].length : 0
  }
}
function nn() {
  return function (e, t) {
    t.normalize(e)
  }
}
function wt(e) {
  var t = (e.re = PO()(e.__opts__)),
    n = e.__tlds__.slice()
  e.onCompile(), e.__tlds_replaced__ || n.push(VO), n.push(t.src_xn), (t.src_tlds = n.join('|'))
  function r(c) {
    return c.replace('%TLDS%', t.src_tlds)
  }
  ;(t.email_fuzzy = RegExp(r(t.tpl_email_fuzzy), 'i')),
    (t.link_fuzzy = RegExp(r(t.tpl_link_fuzzy), 'i')),
    (t.link_no_ip_fuzzy = RegExp(r(t.tpl_link_no_ip_fuzzy), 'i')),
    (t.host_fuzzy_test = RegExp(r(t.tpl_host_fuzzy_test), 'i'))
  var o = []
  e.__compiled__ = {}
  function s(c, l) {
    throw new Error('(LinkifyIt) Invalid schema "' + c + '": ' + l)
  }
  Object.keys(e.__schemas__).forEach(function (c) {
    var l = e.__schemas__[c]
    if (l !== null) {
      var a = { validate: null, link: null }
      if (((e.__compiled__[c] = a), NO(l))) {
        OO(l.validate) ? (a.validate = YO(l.validate)) : en(l.validate) ? (a.validate = l.validate) : s(c, l),
          en(l.normalize) ? (a.normalize = l.normalize) : l.normalize ? s(c, l) : (a.normalize = nn())
        return
      }
      if (BO(l)) {
        o.push(c)
        return
      }
      s(c, l)
    }
  }),
    o.forEach(function (c) {
      !e.__compiled__[e.__schemas__[c]] ||
        ((e.__compiled__[c].validate = e.__compiled__[e.__schemas__[c]].validate),
        (e.__compiled__[c].normalize = e.__compiled__[e.__schemas__[c]].normalize))
    }),
    (e.__compiled__[''] = { validate: null, normalize: nn() })
  var i = Object.keys(e.__compiled__)
    .filter(function (c) {
      return c.length > 0 && e.__compiled__[c]
    })
    .map(HO)
    .join('|')
  ;(e.re.schema_test = RegExp('(^|(?!_)(?:[><\uFF5C]|' + t.src_ZPCc + '))(' + i + ')', 'i')),
    (e.re.schema_search = RegExp('(^|(?!_)(?:[><\uFF5C]|' + t.src_ZPCc + '))(' + i + ')', 'ig')),
    (e.re.schema_at_start = RegExp('^' + e.re.schema_search.source, 'i')),
    (e.re.pretest = RegExp('(' + e.re.schema_test.source + ')|(' + e.re.host_fuzzy_test.source + ')|@', 'i')),
    XO(e)
}
function WO(e, t) {
  var n = e.__index__,
    r = e.__last_index__,
    o = e.__text_cache__.slice(n, r)
  ;(this.schema = e.__schema__.toLowerCase()),
    (this.index = n + t),
    (this.lastIndex = r + t),
    (this.raw = o),
    (this.text = o),
    (this.url = o)
}
function Wt(e, t) {
  var n = new WO(e, t)
  return e.__compiled__[n.schema].normalize(n, e), n
}
function M(e, t) {
  if (!(this instanceof M)) return new M(e, t)
  t || (UO(e) && ((t = e), (e = {}))),
    (this.__opts__ = Yt({}, An, t)),
    (this.__index__ = -1),
    (this.__last_index__ = -1),
    (this.__schema__ = ''),
    (this.__text_cache__ = ''),
    (this.__schemas__ = Yt({}, jO, e)),
    (this.__compiled__ = {}),
    (this.__tlds__ = $O),
    (this.__tlds_replaced__ = !1),
    (this.re = {}),
    wt(this)
}
M.prototype.add = function (t, n) {
  return (this.__schemas__[t] = n), wt(this), this
}
M.prototype.set = function (t) {
  return (this.__opts__ = Yt(this.__opts__, t)), this
}
M.prototype.test = function (t) {
  if (((this.__text_cache__ = t), (this.__index__ = -1), !t.length)) return !1
  var n, r, o, s, i, c, l, a, u
  if (this.re.schema_test.test(t)) {
    for (l = this.re.schema_search, l.lastIndex = 0; (n = l.exec(t)) !== null; )
      if (((s = this.testSchemaAt(t, n[2], l.lastIndex)), s)) {
        ;(this.__schema__ = n[2]),
          (this.__index__ = n.index + n[1].length),
          (this.__last_index__ = n.index + n[0].length + s)
        break
      }
  }
  return (
    this.__opts__.fuzzyLink &&
      this.__compiled__['http:'] &&
      ((a = t.search(this.re.host_fuzzy_test)),
      a >= 0 &&
        (this.__index__ < 0 || a < this.__index__) &&
        (r = t.match(this.__opts__.fuzzyIP ? this.re.link_fuzzy : this.re.link_no_ip_fuzzy)) !== null &&
        ((i = r.index + r[1].length),
        (this.__index__ < 0 || i < this.__index__) &&
          ((this.__schema__ = ''), (this.__index__ = i), (this.__last_index__ = r.index + r[0].length)))),
    this.__opts__.fuzzyEmail &&
      this.__compiled__['mailto:'] &&
      ((u = t.indexOf('@')),
      u >= 0 &&
        (o = t.match(this.re.email_fuzzy)) !== null &&
        ((i = o.index + o[1].length),
        (c = o.index + o[0].length),
        (this.__index__ < 0 || i < this.__index__ || (i === this.__index__ && c > this.__last_index__)) &&
          ((this.__schema__ = 'mailto:'), (this.__index__ = i), (this.__last_index__ = c)))),
    this.__index__ >= 0
  )
}
M.prototype.pretest = function (t) {
  return this.re.pretest.test(t)
}
M.prototype.testSchemaAt = function (t, n, r) {
  return this.__compiled__[n.toLowerCase()] ? this.__compiled__[n.toLowerCase()].validate(t, r, this) : 0
}
M.prototype.match = function (t) {
  var n = 0,
    r = []
  this.__index__ >= 0 && this.__text_cache__ === t && (r.push(Wt(this, n)), (n = this.__last_index__))
  for (var o = n ? t.slice(n) : t; this.test(o); )
    r.push(Wt(this, n)), (o = o.slice(this.__last_index__)), (n += this.__last_index__)
  return r.length ? r : null
}
M.prototype.matchAtStart = function (t) {
  if (((this.__text_cache__ = t), (this.__index__ = -1), !t.length)) return null
  var n = this.re.schema_at_start.exec(t)
  if (!n) return null
  var r = this.testSchemaAt(t, n[2], n[0].length)
  return r
    ? ((this.__schema__ = n[2]),
      (this.__index__ = n.index + n[1].length),
      (this.__last_index__ = n.index + n[0].length + r),
      Wt(this, 0))
    : null
}
M.prototype.tlds = function (t, n) {
  return (
    (t = Array.isArray(t) ? t : [t]),
    n
      ? ((this.__tlds__ = this.__tlds__
          .concat(t)
          .sort()
          .filter(function (r, o, s) {
            return r !== s[o - 1]
          })
          .reverse()),
        wt(this),
        this)
      : ((this.__tlds__ = t.slice()), (this.__tlds_replaced__ = !0), wt(this), this)
  )
}
M.prototype.normalize = function (t) {
  t.schema || (t.url = 'http://' + t.url),
    t.schema === 'mailto:' && !/^mailto:/i.test(t.url) && (t.url = 'mailto:' + t.url)
}
M.prototype.onCompile = function () {}
var GO = M
const ZO = {},
  JO = Object.freeze(
    Object.defineProperty({ __proto__: null, default: ZO }, Symbol.toStringTag, { value: 'Module' }),
  ),
  KO = er(JO)
var QO = {
    options: {
      html: !1,
      xhtmlOut: !1,
      breaks: !1,
      langPrefix: 'language-',
      linkify: !1,
      typographer: !1,
      quotes: '\u201C\u201D\u2018\u2019',
      highlight: null,
      maxNesting: 100,
    },
    components: { core: {}, block: {}, inline: {} },
  },
  tH = {
    options: {
      html: !1,
      xhtmlOut: !1,
      breaks: !1,
      langPrefix: 'language-',
      linkify: !1,
      typographer: !1,
      quotes: '\u201C\u201D\u2018\u2019',
      highlight: null,
      maxNesting: 20,
    },
    components: {
      core: { rules: ['normalize', 'block', 'inline', 'text_join'] },
      block: { rules: ['paragraph'] },
      inline: { rules: ['text'], rules2: ['balance_pairs', 'fragments_join'] },
    },
  },
  eH = {
    options: {
      html: !0,
      xhtmlOut: !0,
      breaks: !1,
      langPrefix: 'language-',
      linkify: !1,
      typographer: !1,
      quotes: '\u201C\u201D\u2018\u2019',
      highlight: null,
      maxNesting: 20,
    },
    components: {
      core: { rules: ['normalize', 'block', 'inline', 'text_join'] },
      block: {
        rules: [
          'blockquote',
          'code',
          'fence',
          'heading',
          'hr',
          'html_block',
          'lheading',
          'list',
          'reference',
          'paragraph',
        ],
      },
      inline: {
        rules: [
          'autolink',
          'backticks',
          'emphasis',
          'entity',
          'escape',
          'html_inline',
          'image',
          'link',
          'newline',
          'text',
        ],
        rules2: ['balance_pairs', 'emphasis', 'fragments_join'],
      },
    },
  },
  st = E,
  nH = Dt,
  rH = o3,
  oH = q3,
  sH = cO,
  cH = zO,
  iH = GO,
  $ = tt,
  En = KO,
  lH = { default: QO, zero: tH, commonmark: eH },
  aH = /^(vbscript|javascript|file|data):/,
  uH = /^data:image\/(gif|png|jpeg|webp);/
function fH(e) {
  var t = e.trim().toLowerCase()
  return aH.test(t) ? !!uH.test(t) : !0
}
var Dn = ['http:', 'https:', 'mailto:']
function pH(e) {
  var t = $.parse(e, !0)
  if (t.hostname && (!t.protocol || Dn.indexOf(t.protocol) >= 0))
    try {
      t.hostname = En.toASCII(t.hostname)
    } catch {}
  return $.encode($.format(t))
}
function hH(e) {
  var t = $.parse(e, !0)
  if (t.hostname && (!t.protocol || Dn.indexOf(t.protocol) >= 0))
    try {
      t.hostname = En.toUnicode(t.hostname)
    } catch {}
  return $.decode($.format(t), $.decode.defaultChars + '%')
}
function I(e, t) {
  if (!(this instanceof I)) return new I(e, t)
  t || st.isString(e) || ((t = e || {}), (e = 'default')),
    (this.inline = new cH()),
    (this.block = new sH()),
    (this.core = new oH()),
    (this.renderer = new rH()),
    (this.linkify = new iH()),
    (this.validateLink = fH),
    (this.normalizeLink = pH),
    (this.normalizeLinkText = hH),
    (this.utils = st),
    (this.helpers = st.assign({}, nH)),
    (this.options = {}),
    this.configure(e),
    t && this.set(t)
}
I.prototype.set = function (e) {
  return st.assign(this.options, e), this
}
I.prototype.configure = function (e) {
  var t = this,
    n
  if (st.isString(e) && ((n = e), (e = lH[n]), !e))
    throw new Error('Wrong `markdown-it` preset "' + n + '", check name')
  if (!e) throw new Error("Wrong `markdown-it` preset, can't be empty")
  return (
    e.options && t.set(e.options),
    e.components &&
      Object.keys(e.components).forEach(function (r) {
        e.components[r].rules && t[r].ruler.enableOnly(e.components[r].rules),
          e.components[r].rules2 && t[r].ruler2.enableOnly(e.components[r].rules2)
      }),
    this
  )
}
I.prototype.enable = function (e, t) {
  var n = []
  Array.isArray(e) || (e = [e]),
    ['core', 'block', 'inline'].forEach(function (o) {
      n = n.concat(this[o].ruler.enable(e, !0))
    }, this),
    (n = n.concat(this.inline.ruler2.enable(e, !0)))
  var r = e.filter(function (o) {
    return n.indexOf(o) < 0
  })
  if (r.length && !t) throw new Error('MarkdownIt. Failed to enable unknown rule(s): ' + r)
  return this
}
I.prototype.disable = function (e, t) {
  var n = []
  Array.isArray(e) || (e = [e]),
    ['core', 'block', 'inline'].forEach(function (o) {
      n = n.concat(this[o].ruler.disable(e, !0))
    }, this),
    (n = n.concat(this.inline.ruler2.disable(e, !0)))
  var r = e.filter(function (o) {
    return n.indexOf(o) < 0
  })
  if (r.length && !t) throw new Error('MarkdownIt. Failed to disable unknown rule(s): ' + r)
  return this
}
I.prototype.use = function (e) {
  var t = [this].concat(Array.prototype.slice.call(arguments, 1))
  return e.apply(e, t), this
}
I.prototype.parse = function (e, t) {
  if (typeof e != 'string') throw new Error('Input data should be a String')
  var n = new this.core.State(e, this, t)
  return this.core.process(n), n.tokens
}
I.prototype.render = function (e, t) {
  return (t = t || {}), this.renderer.render(this.parse(e, t), this.options, t)
}
I.prototype.parseInline = function (e, t) {
  var n = new this.core.State(e, this, t)
  return (n.inlineMode = !0), this.core.process(n), n.tokens
}
I.prototype.renderInline = function (e, t) {
  return (t = t || {}), this.renderer.render(this.parseInline(e, t), this.options, t)
}
var dH = I
;(function (e) {
  e.exports = dH
})(gn)
const gH = fn(gn.exports)
function mH(e) {
  return e !== null && typeof e == 'object' && typeof e.then == 'function' && typeof e.catch == 'function'
}
function bH(e, t) {
  const n = [],
    r = []
  let o = 1,
    i = new gH({
      highlight: function (c, l) {
        const a = t(c, l)
        if (mH(a)) {
          const u = `{{colorize.${o++}.${Math.random()}}}`
          return n.push(a), r.push(u), u
        } else return a
      },
    }).render(e)
  return r.length
    ? new Promise(c => {
        Promise.all(n).then(l => {
          const a = {}
          for (let f = 0; f < r.length; f++) a[r[f]] = l[f]
          var u = /\{\{colorize[^}]+\}\}/g
          ;(i = i.replaceAll(u, f => a[f] || f)), c(i)
        })
      })
    : Promise.resolve(i)
}
function vH(e) {
  const t = {}
  return (
    e.sections &&
      e.sections.forEach(n => {
        n.lines &&
          (n.lines = n.lines.filter(r => {
            var o
            return r.code !== void 0 && (o = r.info) != null && o.provides
              ? ((t[r.info.provides] = r), !1)
              : !0
          }))
      }),
    t
  )
}
function _H(e) {
  if (e && e[0] === '#') {
    const t = e.indexOf(' ')
    e = e.substring(t + 1)
  }
  return e
}
function xH(e) {
  var o
  const t = []
  let n, r
  return (
    (o = e.sections) == null ||
      o.forEach((s, i) => {
        var c
        s.level && s.level < 3
          ? ((n = {
              title: _H(s.title),
              path: ((c = s.info) == null ? void 0 : c.path) || i + '',
              info: s.info,
              level: s.level,
              sections: [s],
            }),
            n.level > 1 && r && (n.parentTitle = r.title),
            n.level == 1 && (r = n),
            t.push(n))
          : n
          ? n.sections.push(s)
          : s.title && console.warn('skipping section without parent ', s)
      }),
    t
  )
}
function kH(e, t) {
  e.onDidScrollChange(n => t.setScrollTop(n.scrollTop)), t.onDidScrollChange(n => e.setScrollTop(n.scrollTop))
}
const yH = { js: 'typescript', jsx: 'typescript' },
  wH = (e, t) => Mn(e, yH[t] || t),
  CH = (e, t) => (e !== void 0 ? e + t : '')
class AH extends Gt {
  constructor() {
    super(...arguments)
    ft(this, 'defCodeRunner', function () {})
    ft(this, 'codeRunner')
    ft(this, 'runnerMap', {})
  }
  onPrepareIframe(n) {
    return this.iframe.onPrepareIframe(n)
  }
  registerRunner(n, r) {
    this.runnerMap[n] = r
  }
  init() {
    this.compiled.editor.updateOptions({ readOnly: !0 }),
      kH(this.editor.editor, this.compiled.editor),
      this.editor.editor.getModel().onDidChangeContent(r => {
        pr(this.iframe, this.editor, { otherEditor: this.compiled, codeRunner: this.codeRunner })
      })
    const n = (this.mdArea.scroller = new it(this.mdArea, {
      wheelSpeed: 2,
      wheelPropagation: !0,
      minScrollbarLength: 20,
    }))
    Jt(this.mdArea, r => n.update())
  }
  showMd(n, r) {
    const o = Pn(n),
      s = vH(o)
    ;(this.chapters = xH(o)),
      (this.menuItems.innerHTML = ''),
      Zt(this.menuItems, this.chapters.map(this.tplChapterButton)),
      (this.providedMap = s),
      this.showChapter(r ? this.chapterIndex : 0)
  }
  showChapterPath(n) {
    this.showChapter(this.chapters ? this.chapters.findIndex(r => r.path === n) : -1)
  }
  showChapter(n, r = 0) {
    var u
    const { state: o, chapters: s, providedMap: i, runnerMap: c } = this
    let l = this.chapterIndex + r
    r || (l = n), (this.chapterIndex = l)
    const a = l >= 0 ? s[l] : null
    if (a) {
      ;[...this.menuItems.children].forEach(p => {
        if (p.getAttribute) {
          const d = p.getAttribute('path') === a.path
          Ln(p, 'selected', d), d && (this.currentChapterButton = p)
        }
      }),
        dr(a, i)
      let f = ''
      ;(this.codeRunner = this.defCodeRunner),
        (u = a.sections) == null ||
          u.forEach(p => {
            var d
            ;(d = p.lines) == null ||
              d.forEach(m => {
                var _
                if (!f && m.code) {
                  const { info: b = {} } = m
                  if (
                    b.code === 'initial' &&
                    ((f =
                      (_ = m.lines) == null
                        ? void 0
                        : _.join(`
`)),
                    b.runner)
                  ) {
                    const g = c[b.runner]
                    c[b.runner]
                      ? (this.codeRunner = g)
                      : console.log('runner_name', b.runner, 'not found, using default')
                  }
                }
              })
          })
      let h = on(a, '', !0, !0)
      this.editor.setValue(f),
        bH(h, wH).then(p => {
          this.md.innerHTML = p
        })
    } else this.md.innerHTML = ''
    ;(o.chapterTitle = (a == null ? void 0 : a.level) == 1 ? '' : a == null ? void 0 : a.title),
      (o.parentTitle =
        (a == null ? void 0 : a.level) == 1
          ? a == null
            ? void 0
            : a.title
          : CH(a == null ? void 0 : a.parentTitle, ' / ')),
      (o.disablePrev = l <= 0),
      (o.disableNext = !(l >= 0 && l < s.length - 1)),
      setTimeout(() => {
        this.chapterName.focus(), (this.mdArea.scrollTop = 0), this.mdArea.scroller.update()
      }, 1)
  }
  tpl(n, r, o) {
    o.menuHidden = !0
    const s = () => this.showChapter(0, 1)
    this.tplChapterButton = u =>
      n(
        'button',
        { class: 'btn', level: u.level, path: u.path, onclick: () => this.showChapterPath(u.path) },
        u.title,
      )
    const i = u => {
        const f = this.chapterName,
          h = this.menuItems.style
        setTimeout(() => {
          var p
          ;(h.top = f.offsetHeight + 'px'),
            (h.left = f.offsetLeft + 'px'),
            (h.width = f.offsetWidth + 'px'),
            (p = this.currentChapterButton) == null || p.focus()
        }, 0)
      },
      c = n(
        'div',
        { class: 'tutorial-menu fxs posr' },
        n(
          'button',
          { class: 'btn-icon-large', disabled: r.disablePrev, onclick: () => this.showChapter(0, -1) },
          '<',
        ),
        n(
          'button',
          { p: 'chapterName', class: 'fxcv1 padh05 btn', onclick: i },
          n('b', { style: 'margin-right: 0.5em' }, r.parentTitle),
          r.chapterTitle,
        ),
        n('button', { p: 'nextButton', class: 'btn-icon-large', disabled: r.disableNext, onclick: s }, '>'),
      ),
      l = n(
        'div',
        { class: 'fx1 owh posr tutorial-section', p: 'mdArea' },
        n('div', { class: 'tutorial-text pad', p: 'md' }),
        n(
          'div',
          { class: 'fx fxje pad tutorial-buttons-bottom' },
          n('button', { class: 'btn btn1', disabled: r.disableNext, onclick: s }, 'Next ->'),
        ),
      )
    return (
      Tn((this.menuItems = n('button', { class: 'tutorial-menu-pop pad05 fxs fxfc' }))),
      n(
        null,
        null,
        n(
          'div',
          { class: 'fx1 c-main owh' },
          n(
            'div',
            { class: 'c-left fxs1 fxfc owh' },
            c,
            l,
            n('div', { class: 'fxs1 fxfc owh', hidden: !0 }, n('div', { class: 'fxs1 owh fxfc' })),
          ),
          n(
            'div',
            { class: 'fxs fxfc owh' },
            n(
              'div',
              { class: 'fxs1 owh' },
              n('div', { class: 'l-b-box-c1' }, n('div', null, 'Code'), n(ue, { p: 'editor', class: 'owh' })),
              n(
                'div',
                { class: 'l-b-box-c1' },
                n('div', null, 'Transformed'),
                n(ue, { p: 'compiled', class: 'owh' }),
              ),
            ),
            n(
              'div',
              { class: 'fxs1 fxfc owh' },
              n(
                'div',
                { class: 'l-b-box-c1 owh' },
                n('div', null, 'Output'),
                n(tr, { p: 'iframe', class: 'fxs owh' }),
              ),
            ),
          ),
        ),
      )
    )
  }
}
const EH = (...e) => fetch(...e).then(t => t.text())
Rn(Fn)
self._mark = 'MAIN'
const DH = e => {
  Zt(
    e.contentDocument.head,
    vt(
      'style',
      null,
      `
@import url(https://fonts.googleapis.com/css?family=Roboto:400,100,100italic,300,300ita\u200C\u200Blic,400italic,500,500italic,700,700italic,900italic,900);
html, body {
  font-family: 'Roboto', sans-serif;
  width:100%;
  height:100%;
  padding:0;
  margin:0;
  box-sizing: border-box;
}  
body{
  padding: 20px;
}
  `,
    ),
  )
}
ir(Babel)
In(monaco)
const qH = './monaco',
  SH = {
    editorWorkerService: 'editor',
    css: 'css',
    html: 'html',
    json: 'json',
    typescript: 'ts',
    javascript: 'ts',
    less: 'css',
    scss: 'css',
    handlebars: 'html',
    razor: 'html',
  }
self.MonacoEnvironment = { getWorkerUrl: (e, t) => `${qH}/${SH[t]}.worker.js` }
const ut = (self.APP = vt(AH, { class: 'fxs1' }))
Zt(document.body, ut)
ut.onPrepareIframe(DH)
ut.defCodeRunner = (e, t) => {
  const r = Qt(e, { filename: 'code_from_editor.js' }).code
  Ct(r, t)
}
ut.registerRunner('render_jsx', (e, t) => {
  const n = `import {h,insert} from './jsx2dom.js';const __JSX__ = ${e};
insert(document.body,__JSX__)`,
    o = Qt(n, { filename: 'code_from_editor.js' }).code
  Ct(o, t)
})
const TH = 'demistify.jsx.md'
EH('./' + TH).then(e => {
  ut.showMd(e)
})
//# sourceMappingURL=demistify.2c009095.js.map
