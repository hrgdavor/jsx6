import { ScrollController, VirtualScroll } from './../esm/index.js';


const container = document.getElementById('scroll-container')
const itemsContainer = document.getElementById('list-items-container')
const scrollYDisplay = document.getElementById('scroll-y')

const ITEM_HEIGHT = parseInt(getComputedStyle(document.documentElement)
    .getPropertyValue('--item-height'))
const TOTAL_ITEMS = 10000

const items = Array.from({ length: TOTAL_ITEMS }, (_, i) => ({
    id: i,
    title: `Product #${i + 1}`,
    subtitle: `High-performance virtual entry ${i * 7}ms offset`,
}))

function createItem() {
    const itemEl = document.createElement('div')
    itemEl.className = 'list-item'
    itemEl.innerHTML = `
        <div class="item-index"></div>
        <div class="item-content">
            <div class="item-title"></div>
            <div class="item-subtitle"></div>
        </div>
    `
    itemEl._indexEl = itemEl.querySelector('.item-index')
    itemEl._titleEl = itemEl.querySelector('.item-title')
    itemEl._subtitleEl = itemEl.querySelector('.item-subtitle')
    return itemEl
}

function updateItemContent(el, item) {
    el.dataset.index = item.id

    el._indexEl.textContent = item.id
    el._titleEl.textContent = item.title
    el._subtitleEl.textContent = item.subtitle
}

const onScroll = (scrollTop) => {
    scrollYDisplay.textContent = Math.floor(scrollTop)
}

// Attach header of ITEM_HEIGHT, so items start below it
const vs = new VirtualScroll({
    itemsContainer,
    itemHeight: ITEM_HEIGHT,
    items,
    keyField: (x => x.id),
    buffer: 0,
    createItem,
    updateItemContent,
    offsetTop: ITEM_HEIGHT  // Offset by the header height
})

const controller = new ScrollController(
    { virtualScroll: vs, container, onScroll }
)

controller.start()

window.vs = vs
