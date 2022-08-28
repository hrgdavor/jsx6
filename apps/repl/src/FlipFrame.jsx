import { Jsx6, fireEvent, observeResize } from '@jsx6/jsx6'

import { Defered } from './async/Defered'

const onPrepareIframe = 'onPrepareIframe'
const eventMap = new WeakMap()

function getEventListenerArr(obj, name, create = false) {
  let objMap = eventMap.get(obj)
  if (!objMap) {
    if (create) eventMap.set(obj, (objMap = new Map()))
    else return
  }
  let arr = objMap.get(name)
  if (!arr) {
    if (create) objMap.set(name, (arr = []))
    else return
  }
  return arr
}

function addEventListener(obj, name, listener) {
  getEventListenerArr(obj, name, true).push(listener)
  // todo return clear function
}

function fireEventListener(obj, name, params) {
  getEventListenerArr(obj, name)?.forEach(listener => {
    try {
      listener(...params)
    } catch (error) {
      console.error(error.message, error, 'listener', listener)
    }
  })
}

export class FlipFrame extends Jsx6 {
  constructor(...args) {
    super(...args)
    const [attr] = args
    const iframeAttr = {
      sandbox: attr?.sandbox || 'allow-same-origin',
      src: attr?.src || 'about:blank',
      style: 'position:absolute; display:none; border:none',
    }
    this.iframes = [h('iframe', iframeAttr), h('iframe', iframeAttr)]
    this.frameIndex = 0
  }

  reloadFrame(cb) {
    cb(this.next())
  }

  onPrepareIframe(listener) {
    addEventListener(this, onPrepareIframe, listener)
    this.iframes.forEach(listener)
  }

  waitNext() {
    this.promise?.reject('skipped')
    const next = this.next()
    if (next.__loading) {
      this.promise = new Defered()
      return this.promise.promise
    } else {
      return Promise.resolve(next)
    }
  }

  next() {
    const old = this.iframes[this.frameIndex]
    this.frameIndex = (this.frameIndex + 1) % this.iframes.length
    const next = this.iframes[this.frameIndex]
    old.__loading = true
    old.contentWindow.document.location.reload()
    old.style.display = 'none'
    next.style.display = ''
    return next
  }

  onload(evt) {
    const iframe = evt.target
    evt.target.loadCounter = (evt.target.loadCounter || 0) + 1
    evt.target.__loading = false
    fireEventListener(this, onPrepareIframe, [iframe])
    this.promise?.resolve(iframe)
    this.promise = null
  }

  tpl() {
    return this.iframes
  }

  init() {
    this.iframes.forEach((iframe, i) => {
      iframe.onload = evt => this.onload(evt)
    })
    observeResize(this.el, evt => {
      this.iframes.forEach(iframe => {
        const style = iframe.style
        style.width = evt.contentRect.width + 'px'
        style.height = evt.contentRect.height + 'px'
      })
    })
  }
}
