// @ts-ignore
import Web3 from 'web3';
import Cargo from './cargo';

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

const getBlock = (web3: Web3, ...args: any[]): Promise<number> => new Promise(resolve => {
  web3.eth.getBlock(...args, (err: {}, block: { number: number }) => {
    resolve(err || !block ? -1 : block.number);
  });
});

export default class PollTx extends Emitter {
  web3: Web3;

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

  watch(tx: string) {
    this.pending.push(tx);
    if (!this.watching) {
      this.startWatching();
    }
    this.emit('pendingUpdated', this.pending);
  }

  startWatching() {
    if (this.watching) return;
    this.watching = true;
    const watch = async () => {
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
          completed.map((tx: { blockNumber: number; hash: string }) => (async () => {
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

      window.setTimeout(watch, 1000);
    };

    watch();
  }

  completedFn(tx: { hash: string }) {
    this.pending = this.pending.filter(t => t !== tx.hash);
    this.completed.push(tx.hash);
    this.emit('completed', tx.hash);
    this.emit('pendingUpdated', this.pending);
    if (this.pending.length === 0) {
      this.watching = false;
    }
  }
}
