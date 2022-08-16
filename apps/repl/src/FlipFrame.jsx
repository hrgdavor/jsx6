import { Jsx6 } from '@jsx6/jsx6';
import { Defered } from './async/Defered';

export class FlipFrame extends Jsx6 {
  constructor(...args) {
    super(...args)
    const [attr] = args
    const iframeAttr = {
      sandbox: attr?.sandbox || 'allow-same-origin', 
      src: attr?.src || 'about:blank',
      style: 'position:absolute; width:100%; height:100%; display:none; border:none'
    }
    this.iframes = [
      h('iframe', iframeAttr),
      h('iframe', iframeAttr),
    ]
    this.frameIndex = 0
  }

  reloadFrame(cb) {
    cb(this.next());
  }

  waitNext() {
    this.promise?.reject('skipped');
    const next = this.next();
    if (next.__loading) {
      this.promise = new Defered();
      return this.promise.promise;
    } else {
      return Promise.resolve(next);
    }
  }

  next() {
    const old = this.iframes[this.frameIndex]
    this.frameIndex = (this.frameIndex + 1) % this.iframes.length
    const next = this.iframes[this.frameIndex]
    old.__loading = true;
    old.contentWindow.document.location.reload();
    old.style.display = 'none'
    next.style.display = ''
    return next;
  }

  onload(evt) {
    const iframe = evt.target;
    evt.target.loadCounter = (evt.target.loadCounter || 0) + 1;
    evt.target.__loading = false;
    this.promise?.resolve(iframe);
    this.promise = null;
  }

  tpl(){
    return this.iframes
  }

  init() {
    this.iframes.forEach((iframe,i) =>{
      iframe.onload = evt => this.onload(evt);
    })
  }
}
