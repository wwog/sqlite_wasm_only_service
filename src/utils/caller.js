import { LRUMap } from "./lruCache";

// create a module-level WeakMap to store the cache for each callback
const callbackProxyCache = new WeakMap();
const MAX_CACHE_SIZE = 200;

/**
 * Create an asynchronous call proxy that supports chained calls and path tracking
 * @template T
 * @param {function(paths:string[], args:any[]): Promise<T>} callback - handle function
 * @param {number} [maxCacheSize=MAX_CACHE_SIZE] - every call will be cached, if the cache size exceeds this value, the oldest one will be removed
 * @returns {ProxyHandler<Function>} - ProxyHandler
 *
 * @example
 * const api = createAsyncCaller(async (paths, args) => {
 *   console.log('paths:', paths);
 *   console.log('args:', args);
 *   return 'result';
 * });
 *
 * await api.users.getById(123);  // paths: ['users', 'getById'], args: [123]
 *
 * @example
 * const api = createAsyncCaller(callback, 100);
 *
 * @description en
 * This function creates a proxy object with the following features:
 * 1. Supports infinite level of chained calls
 * 2. Automatically collects call paths
 * 3. Built-in LRU cache mechanism
 * 4. Shares function instances to optimize performance
 *
 * @throws {TypeError} - If the callback is not a function
 */
export function createAsyncCaller(callback, maxCacheSize = MAX_CACHE_SIZE) {
  let proxyCache = callbackProxyCache.get(callback);
  if (!proxyCache) {
    proxyCache = new LRUMap(maxCacheSize);
    callbackProxyCache.set(callback, proxyCache);
  }

  const createInnerCall = (paths = []) => {
    const innerCall = async (...args) => {
      const result = await callback(paths, args);
      return result;
    };
    innerCall.paths = paths;
    return innerCall;
  };

  const innerCreate = (fn = createInnerCall()) => {
    const cacheKey = fn.paths.join(".");

    if (proxyCache.has(cacheKey)) {
      return proxyCache.get(cacheKey);
    }

    const proxy = new Proxy(fn, {
      get(target, prop, receiver) {
        if (typeof prop === "string") {
          const newPaths = [...target.paths, prop];
          const newCacheKey = newPaths.join(".");

          if (proxyCache.has(newCacheKey)) {
            return proxyCache.get(newCacheKey);
          }

          const newProxy = innerCreate(createInnerCall(newPaths));
          proxyCache.set(newCacheKey, newProxy);
          return newProxy;
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    proxyCache.set(cacheKey, proxy);
    return proxy;
  };

  return innerCreate();
}
