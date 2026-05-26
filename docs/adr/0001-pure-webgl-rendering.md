# Pure WebGL Rendering via React Three Fiber

Notes and the canvas are rendered entirely inside a React Three Fiber scene; no DOM elements are used for the note bodies themselves. The atmospheric layer (lighting, gradient sky, parallax depth) and the note content share one WebGL tree.

We chose this over a DOM-only or DOM-over-WebGL hybrid because the product's differentiator is spatial feel — real lighting, real depth, real motion physics — and a hybrid forces us to keep a DOM layer in pixel-perfect sync with a 3D camera, which is fragile under zoom and parallax. The accepted cost is that text editing, accessibility, and copy/paste do not work for free and must be built deliberately (see follow-up decision on the text-editing surface).
