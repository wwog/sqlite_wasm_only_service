export function randomUUID() {
  if (typeof self.crypto !== "undefined") {
    if (typeof self.crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof self.crypto.getRandomValues === "function") {
      const buffer = new Uint8Array(16);
      crypto.getRandomValues(buffer);
      buffer[6] = (buffer[6] & 0x0f) | 0x40; // Version 4
      buffer[8] = (buffer[8] & 0x3f) | 0x80; // Variant 10xx
      const hexArr = new Array(16);
      for (let i = 0; i < 16; i++) {
        hexArr[i] = buffer[i].toString(16).padStart(2, "0");
      }
      return (
        hexArr[0] +
        hexArr[1] +
        hexArr[2] +
        hexArr[3] +
        "-" +
        hexArr[4] +
        hexArr[5] +
        "-" +
        hexArr[6] +
        hexArr[7] +
        "-" +
        hexArr[8] +
        hexArr[9] +
        "-" +
        hexArr[10] +
        hexArr[11] +
        hexArr[12] +
        hexArr[13] +
        hexArr[14] +
        hexArr[15]
      );
    }
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * @template T
 * @returns {{
 *   promise: Promise<T>;
 *   resolve: (value: T) => void;
 *   reject: (reason?: any) => void;
 * }}
 */
export function withResolvers() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

export const getClientID = async () => {
  const nonce = randomUUID() + Date.now().toString(16).slice(-6);
  const clientId = await navigator.locks.request(nonce, async () => {
    const queryResult = await navigator.locks.query();
    return queryResult.held.find((lock) => lock.name === nonce)?.clientId;
  });
  return clientId;
};

export const cacheResult = (fn) => {
  let result;
  return async () => {
    if (result === undefined) {
      result = await fn();
    }
    return result;
  };
};

export const cacheGetClientId = cacheResult(getClientID);

/**
 * @description Apply for a persistent exclusive lock, return the release function and lock object, if the lock is occupied, return null
 */
export async function requestKeepAliveLock(name) {
  const releaser = withResolvers();
  /**
   * @type {{
   *   promise: Promise<Lock|null>;
   *   resolve: (value: Lock|null) => void;
   *   reject: (reason?: any) => void;
   * }}
   */
  const waitLock = withResolvers();

  navigator.locks.request(
    name,
    {
      ifAvailable: true,
      mode: "exclusive",
    },
    async (lock) => {
      waitLock.resolve(lock);
      if (lock) {
        return releaser.promise;
      }
    }
  );

  const lock = await waitLock.promise;
  return {
    lock,
    release: () => {
      releaser.resolve();
    },
  };
}

export function createCounter() {
  let count = 0;
  return () => ++count;
}

export function arrayCompare(a, b, compareFn) {
  let compareFn_ = compareFn || ((a, b) => a === b);
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (!compareFn_(a[i], b[i])) {
      return false;
    }
  }
  return true;
}
