
to setup zoom you have three options 
```js
  <NodeEditor
    onwheel={e => editor.changeZoomMouse(e.deltaY > 0 ? -0.1 : 0.1, e)}
  />
  <NodeEditor
    onwheel={e => editor.changeZoomCenter(e.deltaY > 0 ? -0.1 : 0.1)}
  />
  <NodeEditor
    onwheel={e => editor.changeZoom(e.deltaY > 0 ? -0.1 : 0.1, 0, 0)}
  />
```

- `changeZoomMouse` center zoom on the mouse 
- `changeZoomCenter` that centers zoom on the middle of the editor
- `changeZoom` that centers zoom on custom point
