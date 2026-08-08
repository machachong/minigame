// 通用对象池:飘字/涟漪/粒子复用,避免频繁 GC
export class ObjectPool<T> {
  private free: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, prealloc = 8) {
    this.factory = factory;
    this.reset = reset;
    for (let i = 0; i < prealloc; i++) this.free.push(factory());
  }

  obtain(): T {
    return this.free.length ? this.free.pop()! : this.factory();
  }

  release(obj: T): void {
    this.reset(obj);
    this.free.push(obj);
  }
}
