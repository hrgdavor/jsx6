var X=Object.defineProperty;var Y=(t,e,i)=>e in t?X(t,e,{enumerable:!0,configurable:!0,writable:!0,value:i}):t[e]=i;var d=(t,e,i)=>(Y(t,typeof e!="symbol"?e+"":e,i),i);const W=function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const c of r.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&n(c)}).observe(document,{childList:!0,subtree:!0});function i(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerpolicy&&(r.referrerPolicy=s.referrerpolicy),s.crossorigin==="use-credentials"?r.credentials="include":s.crossorigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=i(s);fetch(s.href,r)}};W();const Z=7,tt=8,J={};class et{}function Et(t){Object.assign(J,t)}function it(t){return J[t]||t}const nt=t=>it("JSX6E"+t),y=(t,e)=>{const i=nt(t);throw console.error(i,e),new Error(i)},N=t=>typeof t=="function",O=t=>typeof t=="string",k=t=>typeof t=="object",st=t=>t.nodeType!==void 0,M=(t,e=Z)=>((!t||!N(t))&&y(e,{func:t}),t),v=(t,e=[])=>{try{t(...e)}catch(i){console.error(i,t,e)}},rt=4,w=5,ot=6,x=new Set;let L=!1,C=!1,D;typeof document<"u"&&(D=window.requestAnimationFrame);function lt(t){D(t)}function S(t){if(C&&y(rt),t instanceof Array){t.forEach(S);return}M(t,w),x.add(t),L||(L=!0,lt(ut))}function ut(){C=!0,x.forEach(t=>v(t)),x.clear(),L=!1,C=!1}function ct(t,e){t.forEach(i=>i(...e))}function K(t,e,i,n){return t.isBinding=!0,t.update=s=>e[i]=s(e[i]()),t.addUpdater=s=>n.push(r=>s(t(r))),t.sync=s=>{s(e[i]()),n.push(()=>s(e[i]()))},t.dirty=()=>{n.length&&S(()=>ct(n,[e[i]]))},t.state=e,t.propName=i,t}function ft(t={},e){const i=[],n={},s={},r={},c=new Map;function A(){const l=i.length;for(let o=0;o<l;o++)try{i[o](U,c,I)}catch(u){console.error(u)}c.clear()}function g(){i.length&&S(A)}const z={set:function(l,o,u,a){return E(o,u)&&g(),!0},get:function(l,o){return t[o]}},I=new Proxy(t,z),U=new Proxy(Q,{set:function(l,o,u,a){return E(o,u)&&g(),!0},get:function(l,o){if(o==="toJSON")return()=>t;if(!r[o]){n[o]=[],s[o]=()=>n[o].forEach(m=>v(m,[t[o]]));const u=function(m){if(arguments.length!==0){if(N(m))return a(m);E(o,m)&&g()}return t[o]},a=m=>K(()=>m(t[o]),U,o,n[o]);u.get=u.set=u,u.toString=()=>y(ot,o),r[o]=K(u,U,o,n[o])}return r[o]}});function Q(l){if(arguments.length)if(N(l)){const o=(...u)=>l(...u);return o.addUpdater=u=>i.push(M(u,w)),o}else if(k(l))f.update(l);else return l;else return f}function E(l,o,u){return u||t[l]!==o?(c.set(l,t[l]),t[l]=o,n[l]&&S(s[l]),!0):!1}function f(){return I}return Object.defineProperty(f,"value",{get:f}),f.toJSON=()=>t,f.push=f.addUpdater=l=>i.push(l),f.dirty=g,f.getValue=()=>({...t}),f.list=i,f.update=(l,o)=>{if(!l)return;let u=!1;for(const a in l)u|=E(a,l[a],o);u&&g()},f.replace=(l,o)=>{if(!l)return;let u=!1;for(const a in l)u|=E(a,l[a],o);for(const a in t)a in l||(u|=E(a,void 0,o));u&&g()},e&&g(),U}function _(t){return t&&t.isJsx6?t.el:t}function h(t,e,i){if(e instanceof Array)return e.map(s=>h(t,s,i));t||y(tt,{parent:t,newChild:e,before:i});const n=t.insertBefore?t:_(t);n.insertBefore||console.error("missing insertBefore",n,t),e.__init&&e.__init(t);try{let s=_(e);s instanceof Array&&(s=s[0]),n.insertBefore(s,_(i))}catch(s){throw console.error("parent",t,"newChild",e,"before",i),s}return e}const Rt=t=>h(document.body,t);class T{constructor(e,i,n){d(this,"isJsx6",!0);d(this,"el");d(this,"contentArea");d(this,"propKey");d(this,"groupKey");d(this,"parent");d(this,"tagName","DIV");d(this,"cName","");d(this,"state",{});e||(e={}),this.$h=P.bind(this),this.attr=e,this.children=i,this.parent=n,e.tagName!==void 0&&(this.tagName=e.tagName,delete e.tagName)}__init(e,i){this.__initialized||(this.createEl(),this.initTemplate(),this.insertChildren(),h(e,this.el,i),this.init(this.state),this.__initialized=!0)}setParent(e){e===window&&console.error("window as parent ",this),this.parent=e}createEl(){this.initState(),this.tagName?(this.el=R(null,null,{tag:this.tagName},this),this.cName&&this.classList.add(this.cName)):this.el=[document.createTextNode("")],this.insertAttr(this.attr),this.contentArea||(this.contentArea=this.el),this.el.propKey=this.propKey,this.el.groupKey=this.groupKey}insertAttr(e){F(e,this.el,this.parent,this)}initState(){this.state&&(this.state=ft(this.state))}created(){}destroy(){delete this.el.component}destroyed(){}initTemplate(){let e=this.tpl(this.$h,this.state,this.state()(),this);if(e){let i=this.el,n=null;return this.el instanceof Array&&(n=this.el[0],i=n.parentNode),R(i,n,e,this),e}}tpl(){}insertChildren(){R(this.contentArea,null,this.children,this)}init(){}get value(){return this.getValue()}getValue(){return this.jsx6SingleValue?this.state.value():this.state().getValue()}set value(e){this.setValue(e)}setValue(e){e==null&&(e={}),e&&k(e)?(this.jsx6SingleValue=!1,this.state().replace(e)):(this.jsx6SingleValue=!0,this.state().replace({value:e}))}addEventListener(e,i){this.el.addEventListener(e,i)}getAttribute(e){return this.el.getAttribute(e)}setAttribute(e,i){return this.el.setAttribute(e,i)}hasAttribute(e){return this.el.hasAttribute(e)}removeAttribute(e){return this.el.removeAttribute(e)}getBoundingClientRect(){return this.el.getBoundingClientRect()}appendChild(e){h(this.el,e)}insertBefore(e,i){if(this.el instanceof Array){const n=this.el[0];this.el.push(h(n.parentNode,e,n))}else h(this.contentArea||this.el,e,i)}get classList(){return this.el.classList}get style(){return this.el.style}get innerHTML(){return this.el.innerHTML}get textContent(){return this.el.textContent}}T.isComponentClass=!0;function G(t,e,i){(i===!1||i===void 0)&&(i=null),i===!0&&(i=e),t.getAttribute(e)!==i&&(i===null?t.removeAttribute(e):t.setAttribute(e,i))}const at={};let b,B,V;const p=1,ht=2,dt=9;typeof document<"u"&&(b=t=>document.createTextNode(t),V=t=>t?document.createElementNS("http://www.w3.org/2000/svg",t):y(p),B=(t,e)=>t?document.createElement(t,e):y(p));function gt(t,e,i,n={},...s){if(!i)return s;if(O(i)){if(t)return{tag:i,attr:n,children:s};{const r=B(i);return F(n,r,e),s&&s.length&&R(r,null,s,e),r}}else if(N(i)){if(i.isComponentClass)return new i(n,s,e);{const r=new T(n,s,e);return r.tpl=i,r}}else y(ht,i)}function $(t,e={},...i){return gt(!1,this,t,e,...i)}const P=$.bind(at);P.bind=t=>{const e=$.bind(t);return e.bind=P.bind,e};function q(t){return t==null?"":O(t)?t:""+t}function R(t,e,i,n=this,s=null,r=B){if(!i)return;let c;if(N(i))c=b(q(i())),t&&h(t,c,e),H(c,e,null,i,n);else if(i instanceof Array)c=i.map(A=>R(t,e,A,n,null,r));else{if(i instanceof T)return i.setParent(n),i.__init(t,e),i;if(st(i))t&&h(t,i,e);else if(k(i)){(j(i.tag)||j(t==null?void 0:t.tagName))&&(r=V);const A=i.then||i.next;A?(c=b("aaaa"),A.call(i,g=>c.textContent=g),t&&h(t,c,e)):(i.tag||y(p,i),c=r(i.tag),F(i.attr,c,n,s),t&&h(t,c,e),i.children&&i.children.length&&R(c,null,i.children,n,null,r))}else c=b(""+i),t&&h(t,c,e)}return c}function j(t){return t&&t.toUpperCase()==="SVG"}function H(t,e,i,n,s){s instanceof T&&(s=s.state());let r;n.makeUpdater?r=n.makeUpdater(t,e,i,n,s):(i?r=mt(t,i,n):r=yt(t,n),n.addUpdater?n.addUpdater(r):s.push(r))}function yt(t,e){const i=function(){const n=q(e());t.textContent!==n&&(t.textContent=n)};return i.node=t,i}function mt(t,e,i){const n=function(){G(t,e,i())};return n.node=t,n.attr=e,n.func=i,n(),n}function F(t,e,i,n){if(!!t)for(const s in t){const r=t[s];s[0]==="o"&&s[1]==="n"?N(r)?e.addEventListener(s.substring(2),r.bind(i)):y(dt,t):s==="key"?(e.loopKey=r,e.$key||(e.$key=r),n&&(n.$key||(n.$key=r),n.loopKey=r)):N(r)?H(e,null,s,r,i):(s==="p"&&Nt(i,n||e,O(r)?r.split("."):r),e.setAttribute&&G(e,s,s==="p"&&r instanceof Array?r.join("."):r))}}function Nt(t,e,[i,n]){n?(t[i]||(t[i]=new et),t[e.$group=i][e.$key=n]=e):t[e.$key=i]=e}export{T as J,Rt as a,P as h,h as i,Et as s,_ as t};
//# sourceMappingURL=insertHtml.9eb1f3c8.js.map