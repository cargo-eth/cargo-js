import Cargo, { Contracts, ContractNames } from './cargo';
import {
  TokenAddress,
  TokenId,
  ContractResaleItemsResponse,
  ContractGroupBase,
} from './types';

const CARGO_LOCAL_STORAGE_TOKEN = '__CARGO_LS_TOKEN_AUTH__';

const signingMessage =
  "Welcome. By signing this message you are verifying your digital identity. This is completely secure and doesn't cost anything!";

type TMintParams = {
  hasFiles: boolean;
  batchMint?: boolean;
  batchNumber?: string;
  vendorId: string;
  tokenAddress: string;
  name?: string;
  description?: string;
  metadata?: string;
  files: File[];
  previewImage: File;
  to?: string;
};

export default class CargoApi {
  requestUrl: string;

  contracts: Contracts;

  accounts: Array<string>;

  cargo: Cargo;

  request: Cargo['request'];

  constructor(requestUrl: string, cargo: Cargo) {
    this.requestUrl = requestUrl;
    this.cargo = cargo;
    this.request = cargo.request;
  }

  setAccounts = (accounts: Array<string>) => {
    this.accounts = accounts;
  };

  // Methods that do not require metamask

  getSignature = (): Promise<string> =>
    new Promise((resolve, reject) => {
      this.cargo.web3.eth.personal.sign(
        signingMessage,
        this.accounts[0],
        (err: Error, result: any) => {
          if (err) return reject(new Error(err.message));
          if (result.error) {
            return reject(new Error(result.error.message));
          }
          resolve(result);
        },
      );
    });

  private isEnabledAndHasProvider = async () => {
    if (!this.cargo.enabled) {
      await this.cargo.enable();
    }
    if (this.cargo.providerRequired) {
      throw new Error('Provider required');
    }
  };

  providerMethod = (fn: Function) => async (...args: any[]) => {
    await this.isEnabledAndHasProvider();
    return fn(...args);
  };

  private sendTx = (options: Object) =>
    new Promise((resolve, reject) => {
      this.cargo.web3.eth.sendTransaction(options, (err: Error, tx: string) => {
        console.log(err);
        if (!err) {
          this.cargo.web3.eth.getTransactionReceipt(
            tx,
            (err: Error, data: any) => {
              if (data && data.status === '0x00') {
                reject('reverted');
              } else {
                resolve(tx);
              }
            },
          );
        }
      });
    });

  // @ts-ignore
  promisify = (fn, ...args) =>
    new Promise((resolve, reject) => {
      // @ts-ignore
      fn(...args, (err, tx) => {
        if (!err) {
          resolve(tx);
          // Coinbase wallet doesnt seem to work well with getTransactionReceipt
          // Get the error Unable to get address if we call it immediately after
          // submitting the transaction, however it does work in metamask.
          // Fixed in coinbase wallet with a set timeout of 10 seconds, but thats
          // not reasonable. Commenting out for now and will revist if needed.

          //   // @ts-ignore
          //   this.cargo.web3.eth.getTransactionReceipt(tx, (err, data) => {
          //     if (err) {
          //       return reject(err);
          //     }
          //     if (data && data.status === '0x00') {
          //       return reject(new Error('reverted'));
          //     } else {
          //       return resolve(tx);
          //     }
          //   });
        } else {
          reject(err);
        }
      });
    });

  getTransaction = (hash: string) =>
    new Promise((resolve, reject) => {
      this.cargo.web3.eth.getTransaction(hash, (err: any, data: any) => {
        if (err) {
          return reject(err);
        } else {
          return resolve(data);
        }
      });
    });

  promisifyData: (fn: Function, ...args: Array<any>) => Promise<any> = (
    fn,
    ...args
  ) =>
    new Promise((resolve, reject) => {
      // @ts-ignore
      fn(...args, (err, data) => {
        if (!err) {
          return resolve(data);
        } else {
          return reject(err);
        }
      });
    });

  // Methods that require metamask
  authenticate = this.providerMethod(async () => {
    const signature = await this.getSignature();
    const [account] = this.cargo.accounts;
    const response = await this.request<{ token: string }, any>(
      '/v3/authenticate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: account,
          signature,
        }),
      },
    );

    if (response.status === 200) {
      const { token } = response.data;
      localStorage.setItem(CARGO_LOCAL_STORAGE_TOKEN, token);
    }

    return response;
  });

  register = this.providerMethod(async (email: string) => {
    const signature = await this.getSignature();
    const [account] = this.cargo.accounts;
    const response = await this.request<{ token: string }, any>(
      '/v3/register',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: account,
          signature,
          email,
        }),
      },
    );

    if (response.status === 200) {
      const { token } = response.data;
      localStorage.setItem(CARGO_LOCAL_STORAGE_TOKEN, token);
    }
    return response;
  });
}
