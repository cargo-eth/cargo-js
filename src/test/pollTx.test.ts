import Cargo from '../cargo';

jest.mock('../cargo', () => jest.fn().mockImplementation(() => {
  const getTransaction = jest.fn(() => ({
    blockNumber: 1,
    hash: '1234',
  }));
  const Api = jest.fn().mockImplementation(() => ({
    getTransaction,
  }));
  const getBlock = jest.fn((_, cb) => cb(null, { number: 2 }));
  return {
    api: new Api(),
    web3: {
      eth: {
        getBlock,
      },
    },
  };
}),
);

describe('PollTx Class', () => {
  beforeEach(() => {
    // @ts-ignore
    Cargo.mockClear();
  });

  test('should intitialize without error', () => {
    jest.useFakeTimers();
    const { default: PollTx } = require('../pollTx');
    const cargo = new Cargo();
    const pollTx = new PollTx(cargo);
  });

  test('should watch tx and emit completed when done', async () => {
    const { default: PollTx } = require('../pollTx');
    const cargo = new Cargo();
    const pollTx = new PollTx(cargo);

    pollTx.pending = ['1234'];
    pollTx.watching = true;
    pollTx.on('completed', (tx: string) => {
      expect(tx).toBe('1234');
    });
    pollTx.on('pendingUpdated', (pending: string[]) => {
      expect(pending).toEqual([]);
    });
    await pollTx.internalWatch();
  });
  test('should remove completed transactions from pending array', async () => {
    const { default: PollTx } = require('../pollTx');
    const cargo = new Cargo();
    const pollTx = new PollTx(cargo);

    pollTx.pending = ['1234'];
    pollTx.watching = true;
    pollTx.on('pendingUpdated', (pending: string[]) => {
      expect(pending).toEqual([]);
      expect(pollTx.pending).toEqual([]);
    });
    await pollTx.internalWatch();
  });
});
