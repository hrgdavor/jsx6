import { ScrollController, VirtualScroll } from './../esm/index.js';

// --- Usage --- //

const container = document.getElementById('scroll-container')
const itemsContainer = document.getElementById('list-items-container')
const scrollYDisplay = document.getElementById('scroll-y')
const elementCountDisplay = document.getElementById('element-count')

const ITEM_HEIGHT = parseInt(getComputedStyle(document.documentElement)
    .getPropertyValue('--item-height'))
const TOTAL_ITEMS = 10000

// Items array with unique IDs for identity-aware reconciliation
const items = Array.from({ length: TOTAL_ITEMS }, (_, i) => ({
    id: i,
    title: `Product #${i + 1}`,
    subtitle: `High-performance virtual entry ${i * 7}ms offset`,
    favorite: false,
}))

function createItem() {
    const itemEl = document.createElement('div')
    itemEl.className = 'list-item'
    itemEl.innerHTML = `
        <div class="item-index"></div>
        <div class="item-content">
            <div class="item-title"></div>
            <div class="item-subtitle"></div>
            <label class="item-favorite"><input type="checkbox"> Favorite</label>
        </div>
    `
    itemEl._indexEl = itemEl.querySelector('.item-index')
    itemEl._checkboxEl = itemEl.querySelector('input[type="checkbox"]')
    itemEl._titleEl = itemEl.querySelector('.item-title')
    itemEl._subtitleEl = itemEl.querySelector('.item-subtitle')
    return itemEl
}

function updateItemContent(el, item) {
    el.dataset.index = item.id

    el._checkboxEl.checked = item.favorite

    el._indexEl.textContent = item.id
    el._titleEl.textContent = item.title
    el._subtitleEl.textContent = item.subtitle
}

const onScroll = (scrollTop) => {
    scrollYDisplay.textContent = Math.floor(scrollTop)
}

// Track checkbox interactions globally
document.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) {
        const itemEl = e.target.closest('.list-item')
        const itemId = parseInt(itemEl.dataset.index, 10)
        const item = items.find(x => x.id === itemId)
        if (item) {
            item.favorite = e.target.checked
        }
    }
})

// Instantiate the virtual scroll
const vs = new VirtualScroll({
    itemsContainer,
    itemHeight: ITEM_HEIGHT,
    items,
    getKey: (x => x.id),
    buffer: 0,
    createItem,
    updateItemContent,
})

const controller = new ScrollController(
    { virtualScroll: vs, container, onScroll }
)

controller.start()


// Allows us to use vs.setHeight(100) in the console!
window.vs = vs

document.querySelector('[data-action="reverse-items"]').addEventListener('click', (e) => {
    items.reverse()
    controller.start()
})
