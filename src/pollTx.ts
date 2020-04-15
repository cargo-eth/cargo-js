// @ts-ignore
import Web3 from 'web3';
import { Cargo } from './cargo';

type EventCallback = (...args: any[]) => void;

class Emitter {
  events: {
    [eventName: string]: EventCallback[];
  };

  constructor() {
    this.events = {};
  }

  on(name: string, fn: EventCallback) {
    const event = this.events[name];
    if (event) {
      this.events[name].push(fn);
    } else {
      this.events[name] = [fn];
    }
  }

  emit(name: string, ...args: any[]) {
    const event = this.events[name];
    if (Array.isArray(event)) {
      event.forEach(fn => {
        fn(...args);
      });
    }
  }
}

const getBlock = (web3: Web3, ...args: any[]): Promise<number> =>
  new Promise(resolve => {
    // @ts-ignore
    web3.eth.getBlock(...args, (err: {}, block: { number: number }) => {
      resolve(err || !block ? -1 : block.number);
    });
  });

export default class PollTx extends Emitter {
  pending: string[];

  completed: string[];

  watching: boolean;

  cargo: Cargo;

  constructor(cargo: Cargo) {
    super();
    this.cargo = cargo;
    this.pending = [];
    this.completed = [];
    this.watching = false;
  }

  // Public function that is called when the user wants to watch a transaction
  public watch(tx: string) {
    this.pending.push(tx);
    if (!this.watching) {
      this.startWatching();
    }
    // An event which is emitted with the updated list of pending transactions
    this.emit('pending', tx, this.pending);
  }

  private internalWatch = async () => {
    if (!this.watching) {
      return;
    }
    const txData = await Promise.all(
      this.pending.map(tx => this.cargo.api.getTransaction(tx)),
    );

    const completed = txData.filter(
      (tx: { blockNumber: number }) => !!tx && tx.blockNumber != null,
    );

    if (completed.length > 0) {
      await Promise.all(
        completed.map((tx: { blockNumber: number; hash: string }) =>
          (async () => {
            const { blockNumber } = tx;
            let block;

            try {
              block = await getBlock(this.cargo.web3, 'latest');
            } catch (e) {
              console.error(e.message);
            }

            if (block && block - blockNumber >= 0) {
              this.completedFn(tx);
            }
          })(),
        ),
      );
    }

    window.setTimeout(this.internalWatch, 1000);
  };

  // Internal function that begins to watch transactions in pending array
  private startWatching() {
    if (this.watching) return;
    this.watching = true;
    this.internalWatch();
  }

  // Internal function that is called when a transaction has been completed
  private completedFn(tx: { hash: string }) {
    // Remove completed transaction from pending array
    this.pending = this.pending.filter(t => t !== tx.hash);
    this.completed.push(tx.hash);
    // An even which is emitted upon a completed transaction
    this.emit('completed', tx.hash, this.pending);
    if (this.pending.length === 0) {
      this.watching = false;
    }
  }
}
