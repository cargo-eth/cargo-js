import Cargo from '../cargo';

jest.mock('../cargo', () => jest.fn().mockImplementation(() => {
  const getTransaction = jest.fn(() => ({
    blockNumber: 1,
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
    Cargo.mockClear();
  });

  test('should intitialize without error', () => {
    jest.useFakeTimers();
    const { default: PollTx } = require('../pollTx');
    const cargo = new Cargo();
    const pollTx = new PollTx(cargo);
  });

  test('should watch tx', async () => {
    const { default: PollTx } = require('../pollTx');
    const cargo = new Cargo();
    const pollTx = new PollTx(cargo);

    pollTx.pending = ['1234'];
    pollTx.watching = true;
    pollTx.on('completed', (tx: string) => {
      console.log('DONE');
    });
    await pollTx.internalWatch();
    // console.log(data);
  });
});
