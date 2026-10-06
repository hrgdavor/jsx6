import { VirtualScroll } from './../esm/index.js'
import { ScrollController } from '../examples/scroll-controller.js'

const container = document.getElementById('scroll-container')
const itemsContainer = document.getElementById('list-items-container')
const tableHeader = document.getElementById('table-header')
const scrollYDisplay = document.getElementById('scroll-y')
const elementCountDisplay = document.getElementById('element-count')

// read the row height from the container: that is the element whose subtree the rows are styled in
// (this demo overrides --item-height there, so reading it from :root would disagree with the CSS)
const ROW_HEIGHT = parseInt(getComputedStyle(container).getPropertyValue('--item-height'))
// the sticky header occupies flow space at the top of the content, so the row grid starts below it
const HEADER_HEIGHT = tableHeader.offsetHeight
const TOTAL_ITEMS = 10000

const items = Array.from({ length: TOTAL_ITEMS }, (_, i) => ({
  id: i,
  name: `Product #${i + 1}`,
  price: ((i * 37) % 900) + 1,
}))

function createItem() {
  const row = document.createElement('div')
  row.className = 'table-row'
  row.innerHTML = `
        <span class="cell cell-index"></span>
        <span class="cell cell-name"></span>
        <span class="cell cell-price"></span>
    `
  row._indexEl = row.querySelector('.cell-index')
  row._nameEl = row.querySelector('.cell-name')
  row._priceEl = row.querySelector('.cell-price')
  return row
}

function updateItemContent(el, item) {
  el._indexEl.textContent = item.id
  el._nameEl.textContent = item.name
  el._priceEl.textContent = `$${item.price}`
}

const vs = new VirtualScroll({
  itemsContainer,
  scroller: container, // enables vs.scrollToIndex()
  itemHeight: ROW_HEIGHT,
  offsetTop: HEADER_HEIGHT, // rows start below the sticky header at rest
  items,
  getKey: x => x.id,
  createItem,
  updateItemContent,
})

const controller = new ScrollController({
  virtualScroll: vs,
  container,
  onScroll: scrollTop => {
    scrollYDisplay.textContent = Math.floor(scrollTop)
    elementCountDisplay.textContent = vs.idDomMap.size
  },
})

controller.start()
elementCountDisplay.textContent = vs.idDomMap.size

document.querySelector('[data-action="jump"]').addEventListener('click', () => controller.scrollToIndex(5000))
document.querySelector('[data-action="top"]').addEventListener('click', () => controller.scrollToIndex(0))

window.vs = vs
