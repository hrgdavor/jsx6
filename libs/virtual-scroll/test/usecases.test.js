import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

import { describe, expect, test, beforeEach, xtest } from "bun:test"
import { VirtualScroll } from "../src/virtual-scroll.js"
import "./helpers.js"




describe('Virtual scroll', () => {
    let vs
    let itemsContainer

    const TOTAL_ITEMS = 10
    const items = Array.from({ length: TOTAL_ITEMS }, (_, i) => ({ id: `${i}` }))
    const ITEM_HEIGHT = 10
    const CONTAINER_HEIGHT = 3 * ITEM_HEIGHT
    const ENOUGH_HEIGHT = 10_0000


    // Write updateItemContent that takes the id as param in the dom
    // Assert that updateItemContent is called with such and such params

    // Verify state is preserved when scrolling away
    beforeEach(() => {
        itemsContainer = document.createElement('div')
        vs = new VirtualScroll({
            createItem,
            updateItemContent,
            itemHeight: ITEM_HEIGHT,
            items,
            itemsContainer,
        })
    })

    test('proper reusability of elements', () => {
        vs.updateViewport(items.length * ITEM_HEIGHT, 0)
        expect(getVisibleElementsTextContent())
            .toEqual(['id:0', 'id:1', 'id:2', 'id:3', 'id:4',
                'id:5', 'id:6', 'id:7', 'id:8', 'id:9',
            ])
        // first render calls update once
        expect(vs.idDomMap.get('0')).wasUpdated(1)

        // remove every second element
        const evens = removeOdd(items)
        vs.items = evens
        
        vs.updateViewport(items.length * ITEM_HEIGHT, 0)

        expect(getVisibleElementsTextContent())
            .toEqual(['id:0', 'id:2', 'id:4', 'id:6', 'id:8',])

        // the FIRST element, being even, should not have been updated
        expect(vs.idDomMap.get('0')).wasUpdated(1)

        vs.items = items
        vs.updateViewport(items.length * ITEM_HEIGHT, 0)
        expect(vs.idDomMap.get('0')).wasUpdated(1)
        expect(vs.idDomMap.get('1')).wasUpdated(2)
    })

    const removeOdd = arr => arr.filter((_, i) => i % 2 === 0)

    function getVisibleElementsTextContent() {
        return Array.from(vs.idDomMap.values())
            .sort((a, b) => a.id - b.id)
            .map(child => child.textContent)
    }

    const createItem = () => {
        const $el = document.createElement('div');
        $el.textContent = ''
        $el.updateCount = 0
        return $el
    }

    const updateItemContent = (element, item) => {
        element.updateCount++
        element.textContent = `id:${item.id}`
    }
})
