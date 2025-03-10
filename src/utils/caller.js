import { LRUMap } from "./lruCache";

// 创建模块级别的WeakMap，用于存储每个callback对应的缓存
const callbackProxyCache = new WeakMap();
const MAX_CACHE_SIZE = 200; // 设置默认最大缓存数量

/**
 * 创建一个异步调用代理，支持链式调用和路径追踪
 * @template T
 * @param {function(paths:string[], args:any[]): Promise<T>} callback - 处理异步调用的回调函数
 * @param {number} [maxCacheSize=MAX_CACHE_SIZE] - 每个callback的最大缓存数量
 * @returns {ProxyHandler<Function>} 返回一个代理处理器，可以通过链式调用收集路径
 *
 * @example
 * // 基本使用
 * const api = createAsyncCaller(async (paths, args) => {
 *   console.log('调用路径:', paths);
 *   console.log('参数:', args);
 *   return 'result';
 * });
 *
 * // 链式调用
 * await api.users.getById(123);  // paths: ['users', 'getById'], args: [123]
 *
 * @example
 * // 使用自定义缓存大小
 * const api = createAsyncCaller(callback, 100);
 *
 * @description
 * 该函数创建一个代理对象，具有以下特性：
 * 1. 支持无限级的链式调用
 * 2. 自动收集调用路径
 * 3. 内置LRU缓存机制
 * 4. 共享函数实例以优化性能
 *
 * @throws {TypeError} 如果callback不是函数
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
