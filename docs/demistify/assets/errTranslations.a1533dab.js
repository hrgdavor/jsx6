var Y=Object.defineProperty;var Z=(t,e,i)=>e in t?Y(t,e,{enumerable:!0,configurable:!0,writable:!0,value:i}):t[e]=i;var d=(t,e,i)=>(Z(t,typeof e!="symbol"?e+"":e,i),i);const tt=function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const l of s.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&n(l)}).observe(document,{childList:!0,subtree:!0});function i(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerpolicy&&(s.referrerPolicy=r.referrerpolicy),r.crossorigin==="use-credentials"?s.credentials="include":r.crossorigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(r){if(r.ep)return;r.ep=!0;const s=i(r);fetch(r.href,s)}};tt();const et=7,it=8,K={};class nt{}function Rt(t){Object.assign(K,t)}function rt(t){return K[t]||t}const st=t=>rt("JSX6E"+t),y=(t,e)=>{const i=st(t);throw console.error(i,e),new Error(i)},E=t=>typeof t=="function",C=t=>typeof t=="string",O=t=>typeof t=="object",ot=t=>t.nodeType!==void 0,j=(t,e=et)=>((!t||!E(t))&&y(e,{func:t}),t),v=(t,e=[])=>{try{t(...e)}catch(i){console.error(i,t,e)}},ut=4,$=5,_=new Set;let J=!1,L=!1,q;typeof document<"u"&&(q=window.requestAnimationFrame);function lt(t){q(t)}function p(t){if(L&&y(ut),t instanceof Array){t.forEach(p);return}j(t,$),_.add(t),J||(J=!0,lt(ct))}function ct(){L=!0,_.forEach(t=>v(t)),_.clear(),J=!1,L=!1}function at(t,e){t.forEach(i=>i(...e))}function w(t,e,i,n){return t.isBinding=!0,t.update=r=>e[i]=r(e[i]()),t.addUpdater=r=>n.push(s=>r(t(s))),t.sync=r=>{r(e[i]()),n.push(()=>r(e[i]()))},t.dirty=()=>{n.length&&p(()=>at(n,[e[i]]))},t.state=e,t.propName=i,t}function ft(t={},e){const i=[],n={},r={},s={},l=new Map;function S(){const u=i.length;for(let o=0;o<u;o++)try{i[o](b,l,U)}catch(c){console.error(c)}l.clear()}function g(){i.length&&p(S)}const z={set:function(u,o,c,f){return N(o,c)&&g(),!0},get:function(u,o){return t[o]}},U=new Proxy(t,z),b=new Proxy(W,{set:function(u,o,c,f){return N(o,c)&&g(),!0},get:function(u,o){if(o==="toJSON")return()=>t;if(o===Symbol.iterator)return F[Symbol.iterator].bind(F);if(!s[o]){n[o]=[],r[o]=()=>n[o].forEach(m=>v(m,[t[o]]));const c=function(m){if(arguments.length!==0){if(E(m))return f(m);N(o,m)&&g()}return t[o]},f=m=>w(()=>m(t[o]),b,o,n[o]);c.get=c.set=c.toString=c,s[o]=w(c,b,o,n[o])}return s[o]}}),F=[b,U,t];function W(u){if(arguments.length)if(E(u)){const o=()=>u(t);return o.addUpdater=c=>i.push(j(c,$)),o}else if(O(u))a.update(u);else return u;else return a}function N(u,o,c){return c||t[u]!==o?(l.set(u,t[u]),t[u]=o,n[u]&&p(r[u]),!0):!1}function a(){return U}return Object.defineProperty(a,"value",{get:a}),a.toJSON=()=>t,a.push=a.addUpdater=u=>i.push(u),a.dirty=g,a.getValue=()=>({...t}),a.list=i,a.update=(u,o)=>{if(!u)return;let c=!1;for(const f in u)c|=N(f,u[f],o);c&&g()},a.replace=(u,o)=>{if(!u)return;let c=!1;for(const f in u)c|=N(f,u[f],o);for(const f in t)f in u||(c|=N(f,void 0,o));c&&g()},e&&g(),b}function x(t){return t&&t.isJsx6?t.el:t}function h(t,e,i){if(e instanceof Array)return e.map(r=>h(t,r,i));t||y(it,{parent:t,newChild:e,before:i});const n=t.insertBefore?t:x(t);n.insertBefore||console.error("missing insertBefore",n,t),e.__init&&e.__init(t);try{let r=x(e);r instanceof Array&&(r=r[0]),n.insertBefore(r,x(i))}catch(r){throw console.error("parent",t,"newChild",e,"before",i),r}return e}const bt=t=>h(document.body,t);class k{constructor(e,i,n){d(this,"isJsx6",!0);d(this,"el");d(this,"contentArea");d(this,"propKey");d(this,"groupKey");d(this,"parent");d(this,"tagName","DIV");d(this,"cName","");d(this,"state",{});e||(e={}),this.$h=T.bind(this),this.attr=e,this.children=i,this.parent=n,e.tagName!==void 0&&(this.tagName=e.tagName,delete e.tagName)}__init(e,i){this.__initialized||(this.createEl(),this.initTemplate(),this.insertChildren(),h(e,this.el,i),this.init(this.state),this.__initialized=!0)}setParent(e){e===window&&console.error("window as parent ",this),this.parent=e}createEl(){this.initState(),this.tagName?(this.el=R(null,null,{tag:this.tagName},this),this.cName&&this.classList.add(this.cName)):this.el=[document.createTextNode("")],this.insertAttr(this.attr),this.contentArea||(this.contentArea=this.el),this.el.propKey=this.propKey,this.el.groupKey=this.groupKey}insertAttr(e){B(e,this.el,this.parent,this)}initState(){this.state&&(this.state=ft(this.state))}created(){}destroy(){delete this.el.component}destroyed(){}initTemplate(){let e=this.tpl(this.$h,this.state,this.state()(),this);if(e){let i=this.el,n=null;return this.el instanceof Array&&(n=this.el[0],i=n.parentNode),R(i,n,e,this),e}}tpl(e,i,n,r){}insertChildren(){R(this.contentArea,null,this.children,this)}init(){}get value(){return this.getValue()}getValue(){return this.jsx6SingleValue?this.state.value():this.state().getValue()}set value(e){this.setValue(e)}setValue(e){e==null&&(e={}),e&&O(e)?(this.jsx6SingleValue=!1,this.state().replace(e)):(this.jsx6SingleValue=!0,this.state().replace({value:e}))}addEventListener(e,i){this.el.addEventListener(e,i)}getAttribute(e){return this.el.getAttribute(e)}setAttribute(e,i){return this.el.setAttribute(e,i)}hasAttribute(e){return this.el.hasAttribute(e)}removeAttribute(e){return this.el.removeAttribute(e)}getBoundingClientRect(){return this.el.getBoundingClientRect()}appendChild(e){h(this.el,e)}insertBefore(e,i){if(this.el instanceof Array){const n=this.el[0];this.el.push(h(n.parentNode,e,n))}else h(this.contentArea||this.el,e,i)}get classList(){return this.el.classList}get style(){return this.el.style}get innerHTML(){return this.el.innerHTML}get textContent(){return this.el.textContent}}k.isComponentClass=!0;function D(t,e,i){(i===!1||i===void 0)&&(i=null),i===!0&&(i=e),t.getAttribute(e)!==i&&(i===null?t.removeAttribute(e):t.setAttribute(e,i))}const M={};let A,X,V;const P=1,ht=2,dt=9,gt=10;typeof document<"u"&&(A=t=>document.createTextNode(t),V=t=>t?document.createElementNS("http://www.w3.org/2000/svg",t):y(P),X=(t,e)=>t?document.createElement(t,e):y(P));function yt(t,e,i,n={},...r){if(!i)return r;if(C(i)){if(t)return{tag:i,attr:n,children:r};{const s=X(i);return B(n,s,e),r&&r.length&&R(s,null,r,e),s}}else{if(E(i))return n=n||{},i.prototype?new i(n,r,e):i(n,r,e);y(ht,i)}}function G(t,e={},...i){return yt(!1,this,t,e,...i)}const T=G.bind(M);T.bind=t=>{const e=G.bind(t);return e.bind=T.bind,e};function At(t,e){return e(T.bind(t))}function H(t){return t==null?"":C(t)?t:""+t}function R(t,e,i,n=this,r=null,s=X){if(!i)return;let l;if(E(i))l=A(H(i())),t&&h(t,l,e),Q(l,e,null,i,n);else if(i instanceof Array)l=i.map(S=>R(t,e,S,n,null,s));else{if(i instanceof k)return i.setParent(n),i.__init(t,e),i;if(ot(i))t&&h(t,i,e);else if(O(i)){(I(i.tag)||I(t==null?void 0:t.tagName))&&(s=V);const S=i.then||i.next;S?(l=A("aaaa"),S.call(i,g=>l.textContent=g),t&&h(t,l,e)):(i.tag||y(P,i),l=s(i.tag),B(i.attr,l,n,r),t&&h(t,l,e),i.children&&i.children.length&&R(l,null,i.children,n,null,s))}else l=A(""+i),t&&h(t,l,e)}return l}function I(t){return t&&t.toUpperCase()==="SVG"}function Q(t,e,i,n,r){r instanceof k&&(r=r.state());let s;n.makeUpdater?s=n.makeUpdater(t,e,i,n,r):(i?s=Et(t,i,n):s=mt(t,n),n.addUpdater?n.addUpdater(s):r.push(s))}function mt(t,e){const i=function(){const n=H(e());t.textContent!==n&&(t.textContent=n)};return i.node=t,i}function Et(t,e,i){const n=function(){D(t,e,i())};return n.node=t,n.attr=e,n.func=i,n(),n}function B(t,e,i,n){if(!!t)for(const r in t){const s=t[r];r[0]==="o"&&r[1]==="n"?E(s)?e.addEventListener(r.substring(2),s.bind(i)):y(dt,t):r==="key"?(e.loopKey=s,e.$key||(e.$key=s),n&&(n.$key||(n.$key=s),n.loopKey=s)):E(s)?Q(e,null,r,s,i):(r==="p"&&St(i,n||e,C(s)?s.split("."):s),e.setAttribute&&D(e,r,r==="p"&&s instanceof Array?s.join("."):s))}}function St(t,e,[i,n]){if(t===M)throw y(gt);n?(t[i]||(t[i]=new nt),t[e.$group=i][e.$key=n]=e):t[e.$key=i]=e}const pt={JSX6E1:"Tag is null",JSX6E2:"Tag type is not supported",JSX6E3:"Translation updater must be a function",JSX6E4:"updater undefined",JSX6E5:"dirty runner must be a function",JSX6E6:`If you are seeing this, you are using a binding function wrong
 - used $state instead state in template 
 - called binding.toString()
property that was used wrongly:`,JSX6E7:"Function required",JSX6E8:"Parent required",JSX6E9:"Event listener must be a function ",JSX6E10:"Context to assign references required, if you want to assign parts of the template to named props, please provide a scope by using domWithScope utility"};export{k as J,bt as a,At as d,pt as e,T as h,h as i,ft as m,Rt as s,x as t};
//# sourceMappingURL=errTranslations.a1533dab.js.map
