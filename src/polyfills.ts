// Some browser bundles expect a Node-style global object during module evaluation.
(globalThis as any).global = globalThis;