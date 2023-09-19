# WEB components 

We will describe different aspect of web components and technologies that accompany the term.

Major parts of building a [webcomponent](https://developer.mozilla.org/en-US/docs/Web/API/Web_components) are:

- [custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements)
- [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) 
- shadow DOM [slots](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSlotElement)
- [templates](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_templates_and_slots) - currently not interested in those while using JSX

It is interesting to know that you can use custom alements or shadow DOM independently of each other.
They are useful on their own. Using just one of them for some cases if perfectly fine and can 
make your life easier, so do not force yourself to using them both unless the combo brings you real benefit.

If you just need shadow DOM to isolate css, you can do that on any element, thus avoiding the need to worry
about registering a custom element.


