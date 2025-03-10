export class LRUMap extends Map {
  /**
   * @param {number} maxSize - cache max size
   */
  constructor(maxSize) {
    super();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  /**
   * get value from cache and update access order
   */
  get(key) {
    if (super.has(key)) {
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.accessOrder.push(key);
      return super.get(key);
    }
    return undefined;
  }

  /**
   * set value to cache and update access order
   */
  set(key, value) {
    if (this.size >= this.maxSize && !super.has(key)) {
      // remove the oldest item
      const oldest = this.accessOrder[0];
      this.accessOrder.shift();
      super.delete(oldest);
    }

    // update access order
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
    return super.set(key, value);
  }
}
