// Polyfill process for Cloudflare Workers/Pages environment to avoid ReferenceErrors
if (typeof process === "undefined") {
  (globalThis as any).process = {
    env: new Proxy({}, {
      get(target, prop) {
        if (typeof prop === "string") {
          return import.meta.env?.[prop] || undefined;
        }
        return undefined;
      }
    })
  };
}
