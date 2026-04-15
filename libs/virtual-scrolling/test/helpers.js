export const DUMMY_ITEMS_CONTAINER = { appendChild: () => { } }

expect.extend({
    // better to test translation
    toBeAtPosition(element, expectedPosition) {
        const actualPosition = element.vsidx

        return {
            pass: actualPosition == expectedPosition,
            message: () => `expected id to be ${expectedPosition} but got ${actualPosition}`
        }
    }
})

// updated X times
expect.extend({
    wasUpdated(element, expected) {
        return {
            pass: expected == element.updateCount,
            message: () => `expected element to have been updated ${expected} times but got ${element.updateCount}`
        }
    }
})

// innerHTML 
