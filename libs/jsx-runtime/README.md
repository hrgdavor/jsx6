# Performance for multiple ResizeObserver and IntersectionObserver

TLDR: It is better to reuse them instead of creating new for each observed element.

Both of the observers have a penalty when number of observes rises, and if they are reused
many more elements can be observed before havin performance issues. 

Here is an article in angular for IntersectionObserver: https://www.bennadel.com/blog/3954-intersectionobserver-api-performance-many-vs-shared-in-angular-11-0-5.htm

Here is link about reusing ResizeObserver https://stackoverflow.com/questions/51528940/resizeobserver-one-vs-multiple-performance

This part of `jsx6` is intentionally separated as it is standalone set of utilities that are useful
by itself. Separation makes it simpler to use, and is less likely to deter devs from using the code.

# IntersectionObserver in action

Here is a video showing a IntersectionObserver that has 101 threshold(one for each pecent). 
This an unlikely real-world use case, but it is neat to show how the observer works.

This example also shows-off how `jsx6` library precisely controls exact parts that need to change
in DOM, and is doing this by having direct references to elements,attributes and text nodes that are dynamic.

https://user-images.githubusercontent.com/2480762/197420342-56ee3381-d9c5-4625-b193-1c2f00178f84.mp4

