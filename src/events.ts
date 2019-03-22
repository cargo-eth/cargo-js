
export default class Emitter {
  private listeners: { [property: string]: Set<(key: any) => any> };
  constructor() {
    this.listeners = {};
  }
  public on(evt: string, fn: () => any) {
    const event = this.listeners[evt];
    if (!event) {
      this.listeners[evt] = new Set([fn]);
    } else if (event.has(fn)) {
      return;
    } else {
      event.add(fn);
    }
  }
  public off(evt: string, fn: any) {
    const event = this.listeners[evt];
    if (event) {
      event.delete(fn);
    }
  }
  public removeAllListeners(evt: string) {
    this.listeners[evt] = void 0;
  }
  public emit(evt: string, data?: any) {
    const event = this.listeners[evt];
    if (event) {
      event.forEach((fn) => {
        fn(data);
      })
    }
  }
}
