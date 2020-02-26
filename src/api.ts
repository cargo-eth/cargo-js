import Cargo, { Contracts, ContractNames } from './cargo';
import {
  TokenAddress,
  TokenId,
  ContractResaleItemsResponse,
  ContractGroupBase,
} from './types';

const CARGO_LOCAL_STORAGE_TOKEN = '__CARGO_LS_TOKEN_AUTH__';

const addToQuery = (query: string, addition: string): string =>
  `${query}${query ? '&' : '?'}${addition}`;

const signingMessage =
  "Welcome. By signing this message you are verifying your digital identity. This is completely secure and doesn't cost anything!";

type ArgsResponse = { args: string[] };

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

  token?: string;

  contracts: Contracts;

  accounts: Array<string>;

  cargo: Cargo;

  request: Cargo['request'];

  constructor(requestUrl: string, cargo: Cargo) {
    this.requestUrl = requestUrl;
    this.cargo = cargo;
    this.request = cargo.request;
    this.token = localStorage.getItem(CARGO_LOCAL_STORAGE_TOKEN);
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

  /**
   * Method that checks for a saved token. If no token
   * is present an error will be thrown.
   */
  authenticatedMethod = <TFn extends Function>(fn: TFn) => async <
    Args extends any[]
  >(
    ...args: Args
  ) => {
    this.checkForToken();
    return fn(...args, this.token);
  };

  checkForToken = () => {
    if (!this.token) {
      throw new Error('authentication-required');
    }
  };

  /**
   * ========================
   * Methods that do not require metamask
   * ========================
   */
  bulkMetadataUpdate = this.authenticatedMethod(
    async (
      contractAddress: string,
      metadata: {
        [tokenId: string]: Object;
      },
      token: string,
    ) => {
      return this.request('/v3/bulk-metadata-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contractAddress,
          metadata,
        }),
      });
    },
  );

  addContractToCrate = this.authenticatedMethod(
    async (contractId: string, crateId: string, token: string) => {
      return this.request<ArgsResponse, any>('/v3/add-contract-to-crate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          crateId,
          contractId,
        }),
      });
    },
  );

  getUserTokensByContract = this.authenticatedMethod(
    async (
      options: {
        page?: string;
        limit?: string;
        contractId: string;
      },
      token: string,
    ) => {
      if (!options || !options.contractId) {
        throw new Error('Missing contract ID');
      }
      let query = '';
      if (options.limit) {
        query += `?limit=${options.limit}`;
      }
      if (options.page) {
        query += `${query.length ? '&' : '?'}page=${options.page}`;
      }
      return this.request(`/v3/get-user-tokens/${options.contractId}${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
  );

  getResaleItems = async (options: {
    crateId?: string;
    contractId?: string;
    page?: string;
    limit?: string;
    owned?: string;
  }) => {
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
    };

    const { page, limit, crateId, contractId, owned } = options || {};

    if (owned && !this.token) {
      throw new Error(
        'Must be authenticated when requesting owned resale items',
      );
    }

    if (owned && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let query = '';

    if (page) {
      query = addToQuery(query, `page=${page}`);
    }

    if (limit) {
      query = addToQuery(query, `limit=${limit}`);
    }

    if (contractId) {
      query = addToQuery(query, `contractId=${contractId}`);
    }

    if (crateId) {
      query = addToQuery(query, `crateId=${crateId}`);
    }

    return this.request(`/v3/get-resale-items${query}`, {
      headers,
    });
  };

  getContracts = async (options: {
    page: string;
    limit: string;
    crateId?: string;
    owned?: boolean;
  }) => {
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
    };

    const { page, limit, crateId, owned } = options || {};

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let query = `?page=${page || '1'}&limit=${limit || '10'}`;

    if (crateId) {
      query += `&crateId=${crateId}`;
    }

    if (owned != null) {
      if (owned === true) {
        query += '&owned=true';
      }
      if (owned === false) {
        query += '&owned=false';
      }
    }

    return this.request(`/v3/get-contracts${query}`, {
      headers,
    });
  };

  createCrate = this.authenticatedMethod(
    async (crateName: string, token: string) => {
      const response = await this.request<{ crateId: string }, any>(
        '/v3/create-crate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: crateName,
          }),
        },
      );

      return response;
    },
  );
  /**
   * ========================
   * Methods that require metamask
   * ========================
   */
  setCrateApplicationFee = this.providerMethod(
    this.authenticatedMethod(
      async (fee: number, crateId: string, token: string) => {
        if (window.isNaN(fee)) {
          throw new Error(`${fee} is not a valid argument`);
        }
        if (!crateId) {
          throw new Error(`"${crateId}" is not a valid crate ID`);
        }
        const response = await this.request<ArgsResponse, any>(
          '/v3/set-crate-application-fee',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              fee,
              crateId,
            }),
          },
        );

        if (response.err) {
          throw new Error(JSON.stringify(response));
        }

        const { args } = response.data;

        const contract = await this.cargo.getContractInstance('cargoSell');

        return this.callTxAndPoll(
          contract.methods.setCrateApplicationFee(...args).send,
        )({
          from: this.cargo.accounts[0],
        });
      },
    ),
  );

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
      this.token = token;
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
      this.token = token;
      localStorage.setItem(CARGO_LOCAL_STORAGE_TOKEN, token);
    }
    return response;
  });

  callTxAndPoll = (method: Function) => async (...args: any[]) => {
    const tx = await method(...args);
    this.cargo.pollTx.watch(tx);
    return tx;
  };

  cancelSale = this.providerMethod(async (resaleItemId: string) => {
    const body: { [key: string]: string } = { resaleItemId };
    const headers: typeof body = {
      'Content-Type': 'application/json',
    };
    if (!this.token) {
      const signature = await this.getSignature();
      body.signature = signature;
      body.sender = this.cargo.accounts[0];
    } else {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await this.request<
      ArgsResponse & { signaturesGenerated?: boolean },
      any
    >('/v3/cancel-sale', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (response.err) {
      throw new Error(JSON.stringify(response));
    }

    const { args, signatureGenerated } = response.data;

    if (signatureGenerated) {
      const contract = await this.cargo.getContractInstance('cargoSell');
      return this.callTxAndPoll(contract.methods.cancelSale(...args).send)({
        from: this.cargo.accounts[0],
      });
    } else {
      return response;
    }
  });

  updateBeneficiaryCommission = this.providerMethod(
    this.authenticatedMethod(
      async (
        beneficiaryAddress: string,
        commission: string,
        crateId: string,
        token: string,
      ) => {
        const response = await this.request<ArgsResponse, any>(
          '/v3/update-beneficiary-commission',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              address: beneficiaryAddress,
              commission,
              crateId,
            }),
          },
        );

        if (response.err) {
          throw new Error(JSON.stringify(response));
        }

        const { args } = response.data;

        const contract = await this.cargo.getContractInstance('cargoVendor');

        return this.callTxAndPoll(
          contract.methods.updateBeneficiaryCommission(...args).send,
        )({
          from: this.cargo.accounts[0],
        });
      },
    ),
  );

  addVendor = this.providerMethod(
    this.authenticatedMethod(
      async (vendorAddress: string, crateId: string, token: string) => {
        const response = await this.request<ArgsResponse, any>(
          '/v3/add-vendor',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              vendorAddress,
              crateId,
            }),
          },
        );

        if (response.err) {
          throw new Error(JSON.stringify(response));
        }

        const { args } = response.data;

        const contract = await this.cargo.getContractInstance('cargoVendor');

        return this.callTxAndPoll(contract.methods.addVendor(...args).send)({
          from: this.cargo.accounts[0],
        });
      },
    ),
  );

  addBeneficiary = this.providerMethod(
    this.authenticatedMethod(
      async (
        crateId: string,
        beneficiaryAddress: string,
        commission: string,
        token: string,
      ) => {
        const response = await this.request<ArgsResponse, any>(
          '/v3/add-beneficiary',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              crateId,
              address: beneficiaryAddress,
              commission,
            }),
          },
        );

        if (response.err) {
          throw new Error(JSON.stringify(response));
        }

        const { args } = response.data;

        const contract = await this.cargo.getContractInstance('cargoVendor');

        return this.callTxAndPoll(
          contract.methods.addBeneficiary(...args).send,
        )({
          from: this.cargo.accounts[0],
        });
      },
    ),
  );

  removeBeneficiary = this.providerMethod(
    this.authenticatedMethod(
      async (beneficiaryAddress: string, crateId: string, token: string) => {
        const response = await this.request<ArgsResponse, any>(
          '/v3/remove-beneficiary',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              beneficiaryAddress,
              crateId,
            }),
          },
        );

        if (response.err) {
          throw new Error(JSON.stringify(response));
        }

        const { args } = response.data;

        const contract = await this.cargo.getContractInstance('cargoVendor');

        return this.callTxAndPoll(
          contract.methods.removeBeneficiary(...args).send,
        )({
          from: this.cargo.accounts[0],
        });
      },
    ),
  );

  createContract = this.providerMethod(
    async (name: string, symbol?: string, crateId?: string) => {
      // Adding this here instead of using this.authenticatedMethod
      // because of optional parameters
      this.checkForToken();

      const response = await this.request<ArgsResponse, any>(
        '/v3/create-contract',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            name,
            symbol,
            crateId,
          }),
        },
      );

      if (response.err) {
        throw new Error(JSON.stringify(response));
      }

      const { args } = response.data;

      const cargoAssetContract = await this.cargo.getContractInstance(
        'cargoAsset',
      );

      const price = await cargoAssetContract.methods.getPrice('create').call();

      const contract = await this.cargo.getContractInstance('nftCreator');

      return this.callTxAndPoll(contract.methods.createContract(...args).send)({
        from: this.cargo.accounts[0],
        value: price,
      });
    },
  );

  mint = this.providerMethod(
    async (
      contractAddress: string,
      amount: string,
      to: string,
      name?: string,
      description?: string,
      metadata?: Object,
      previewImage?: File,
      files?: File[],
    ) => {
      this.checkForToken();
      const cargoAssetInstance = await this.cargo.getContractInstance(
        'cargoAsset',
      );
      const isCargoContract = await cargoAssetInstance.methods
        .verifyContract(contractAddress)
        .call();

      if (!isCargoContract) {
        throw new Error('invalid-contract');
      }

      const formData = new FormData();
      formData.append('contractAddress', contractAddress);
      formData.append('amount', amount);
      if (name) {
        formData.append('name', name);
      }
      if (description) {
        formData.append('description', description);
      }
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
      }
      if (previewImage) {
        formData.append('previewImage', previewImage);
      }
      if (Array.isArray(files)) {
        files.forEach(file => {
          formData.append('file', file);
        });
      }

      const response = await this.request<ArgsResponse, any>('/v3/mint', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        body: formData,
      });

      if (response.err) {
        throw new Error(JSON.stringify(response));
      }

      const { args } = response.data;

      const contract = await this.cargo.getContractInstance(
        'cargoNft',
        contractAddress,
      );

      const int = parseInt(amount);
      const method =
        int === 1
          ? contract.methods.mint(to, ...args)
          : contract.methods.batchMint(amount, to, ...args);

      return this.callTxAndPoll(method.send)({ from: this.cargo.accounts[0] });
    },
  );

  purchase = this.providerMethod(
    async (tokenId: string, contractAddress: string) => {
      const response = await this.request<ArgsResponse, any>('/v3/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenId,
          contractAddress,
          sender: this.cargo.accounts[0],
        }),
      });

      if (response.err) {
        throw new Error(JSON.stringify(response));
      }

      const { args, price } = response.data;

      const contract = await this.cargo.getContractInstance('cargoSell');

      return this.callTxAndPoll(contract.methods.purchase(...args).send)({
        from: this.cargo.accounts[0],
        value: price,
      });
    },
  );

  sell = this.providerMethod(
    async (
      contractAddress: string,
      tokenId: string,
      price: string,
      crateId?: string,
    ) => {
      const [sender] = this.cargo.accounts;
      const body: { [key: string]: string } = {
        sender,
        contractAddress,
        tokenId,
        price,
        crateId,
      };

      const { address: cargoSellAddress } = await this.cargo.getContract(
        'cargoSell',
      );
      const contract = await this.cargo.getContractInstance(
        'cargoNft',
        contractAddress,
      );

      const isApproved = await contract.methods
        .isApprovedForAll(sender, cargoSellAddress)
        .call();

      if (!isApproved) {
        await contract.methods.setApprovalForAll(cargoSellAddress, true).send({
          from: this.accounts[0],
        });
      }

      const headers: { [key: string]: string } = {
        'Content-Type': 'application/json',
      };
      if (!this.token) {
        body.signature = await this.getSignature();
      } else {
        headers.Authorization = `Bearer ${this.token}`;
      }

      return await this.request('/v3/sell', {
        method: 'POST',
        body: JSON.stringify(body),
        headers,
      });
    },
  );

  removeVendor = this.providerMethod(
    this.authenticatedMethod(
      async (vendorAddress: string, crateId: string, token: string) => {
        const response = await this.request<ArgsResponse, any>(
          '/v3/remove-vendor',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              vendorAddress,
              crateId,
            }),
          },
        );

        if (response.err) {
          throw new Error(JSON.stringify(response));
        }

        const { args } = response.data;

        const contract = await this.cargo.getContractInstance('cargoVendor');

        return this.callTxAndPoll(contract.methods.removeVendor(...args).send)({
          from: this.cargo.accounts[0],
        });
      },
    ),
  );
}
