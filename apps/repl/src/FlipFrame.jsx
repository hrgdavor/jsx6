import { observeResize } from '@jsx6/dom-observer'
import { Jsx6, fireEvent, h } from '@jsx6/jsx6'

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
  initAttr(attr) {
    const iframeAttr = {
      sandbox: attr?.sandbox || 'allow-same-origin allow-scripts',
      src: attr?.src || 'about:blank',
      style: 'position:absolute; opacity:0; border:none',
    }
    this.iframes = [h('iframe', iframeAttr), h('iframe', iframeAttr)]
    this.frameIndex = 0
    console.log('attr', attr, this.iframes)
    return attr
  }

  reloadFrame(cb) {
    cb(this.next())
  }

  onPrepareIframe(listener) {
    addEventListener(this, onPrepareIframe, listener)
    this.iframes.forEach(listener)
  }

  waitNext(flipVisibilityNow = true) {
    this.promise?.reject('skipped')
    const next = this.next(flipVisibilityNow)
    if (next.__loading) {
      this.promise = new Defered()
      return this.promise.promise
    } else {
      return Promise.resolve(next)
    }
  }

  next(flipVisibilityNow = true) {
    const old = this.iframes[this.frameIndex]
    this.frameIndex = (this.frameIndex + 1) % this.iframes.length
    const next = this.iframes[this.frameIndex]

    this.toShow = next
    old.__loading = true
    this.toClean = old
    if (flipVisibilityNow) this.applyVisibility()

    return next
  }

  applyVisibility() {
    // this.iframes.forEach(ifr => (ifr.style.display = ifr == this.toShow ? '' : 'none'))
    this.iframes.forEach(ifr => (ifr.style.opacity = ifr == this.toShow ? '1' : '0'))
    this.iframes.forEach(ifr => (ifr.style.zIndex = ifr == this.toShow ? '1' : '0'))
    const old = this.toClean
    old.contentWindow.document.location.reload()
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
