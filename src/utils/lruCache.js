/**
 * LRU（最近最少使用）缓存Map的实现
 * @extends {Map}
 */
export class LRUMap extends Map {
  /**
   * 创建一个新的LRU缓存Map
   * @param {number} maxSize - 缓存的最大容量
   */
  constructor(maxSize) {
    super();
    this.maxSize = maxSize;
    this.accessOrder = [];
  }

  /**
   * 获取缓存中的值，并更新访问顺序
   * @param {string} key - 缓存键
   * @returns {*} 缓存的值或undefined
   */
  get(key) {
    if (super.has(key)) {
      // 更新访问顺序
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      this.accessOrder.push(key);
      return super.get(key);
    }
    return undefined;
  }

  /**
   * 设置缓存值，维护LRU顺序，并在需要时清除最旧的项
   * @param {string} key - 缓存键
   * @param {*} value - 要缓存的值
   * @returns {Map} 返回Map实例
   */
  set(key, value) {
    if (this.size >= this.maxSize && !super.has(key)) {
      // 删除最久未使用的项
      const oldest = this.accessOrder[0];
      this.accessOrder.shift();
      super.delete(oldest);
    }

    // 更新访问顺序
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);
    return super.set(key, value);
  }
}
