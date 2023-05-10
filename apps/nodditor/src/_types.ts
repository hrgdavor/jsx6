// @ts-ignore
import { NodeEditor } from './NodeEditor.jsx'

export interface ConnectorData {
  id: string
  changed: number
  idFull: string
  el: HTMLElement
  root: BlockData
  relPos: Array<number>
  pos: Array<number>
  offsetX: number
  offsetY: number
  size: Array<number>
  editor: NodeEditor
}

export interface HTMLConnector extends HTMLElement {
  ncData: ConnectorData
}

export interface LinePoint {
  pos: Array<number>
  con: ConnectorData
  listen: Array<Function>
  align: string
}

export interface BlockData {
  id: string
  type: string
  pos: Array<number>
  size: Array<number>
  rootNode: HTMLElement
  block: Object
  map: Map<string, ConnectorData>
  resizeSet: Set<Element>
  connectorMap: Map<string, ConnectorData>
  editor: NodeEditor
}

export interface HTMLBlock extends HTMLElement {
  neBlock: BlockData
}
