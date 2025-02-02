import { Emitter } from 'mana-common'
export interface Disposable {
  /**
   * Dispose this object.
   */
  dispose: () => void
}

export namespace Disposable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function is(arg: any): arg is Disposable {
    return !!arg && typeof arg === 'object' && 'dispose' in arg && typeof arg.dispose === 'function'
  }
  export function create(func: () => void): Disposable {
    return {
      dispose: func,
    }
  }
  export const NULL = create(() => {})
}

export class DisposableCollection implements Disposable {
  protected readonly disposables: Disposable[] = []
  protected readonly onDisposeEmitter = new Emitter<void>()

  constructor(...toDispose: Disposable[]) {
    toDispose.forEach(d => this.push(d))
  }

  /**
   * This event is fired only once
   * on first dispose of not empty collection.
   */
  get onDispose() {
    return this.onDisposeEmitter.event
  }

  protected checkDisposed(): void {
    if (this.disposed && !this.disposingElements) {
      this.onDisposeEmitter.fire(undefined)
      this.onDisposeEmitter.dispose()
    }
  }

  get disposed(): boolean {
    return this.disposables.length === 0
  }

  private disposingElements = false

  async dispose(): Promise<void> {
    if (this.disposed || this.disposingElements) {
      return
    }
    this.disposingElements = true
    while (!this.disposed) {
      try {
        const d = this.disposables.pop()
        await d!.dispose()
      } catch (e) {
        console.error(e)
      }
    }
    this.disposingElements = false
    this.checkDisposed()
  }

  push(disposable: Disposable): Disposable {
    const { disposables } = this
    disposables.push(disposable)
    const originalDispose = disposable.dispose.bind(disposable)
    const toRemove = Disposable.create(() => {
      const index = disposables.indexOf(disposable)
      if (index !== -1) {
        disposables.splice(index, 1)
      }
      this.checkDisposed()
    })
    disposable.dispose = () => {
      toRemove.dispose()
      originalDispose()
    }
    return toRemove
  }

  pushAll(disposables: Disposable[]): Disposable[] {
    return disposables.map(disposable => this.push(disposable))
  }
}
