/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Cargo, Contracts, TResp } from './cargo';
import {
  PaginationResponseWithResults,
  VendorBeneficiaryV3,
  CrateVendorV3,
  UserCrateV3,
  GetOrderParams,
  GetUserTokensByContractParams,
  ContractMetadata,
  TokenDetail,
  GetUserShowcaseArgs,
  ContractV3,
  GetShowcaseByIdResponse,
  GetTokensByContractResponse,
  SellErc1155Body,
  StakedTokensResponse,
  GetUserTokensByContractRespose,
  ShowcaseItem,
  TCurrencyAddress,
  Royalty,
  Chain,
} from './types';
import { Order, OrderParams } from './types/Order';

const CARGO_LOCAL_STORAGE_TOKEN = '__CARGO_LS_TOKEN_AUTH__';

const addToQuery = (query: string, addition: string): string =>
  `${query}${query ? '&' : '?'}${addition}`;

const getQuery = (options: { [key: string]: string }): string =>
  Object.entries(options).reduce((a, [key, val]) => {
    a = addToQuery(a, `${key}=${val}`);
    return a;
  }, '');

const signingMessage =
  "Welcome. By signing this message you are verifying your digital identity. This is completely secure and doesn't cost anything!";

type ArgsResponse = { args: string[] };

type MintParams = {
  method?: 'batchMint' | 'mint';
  contractAddress: string;
  amount: string;
  to: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  previewImage?: File;
  files?: File[];
  displayContent?: {
    type: 'audio' | 'video' | '3D';
    files: File[];
  };
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

  clear = (): void => {
    if (window.localStorage) {
      localStorage.removeItem(CARGO_LOCAL_STORAGE_TOKEN);
      localStorage.removeItem(`__CARGO_SIG__${this.cargo.accounts[0]}`);
    }
  };

  setAccounts = (accounts: Array<string>): void => {
    this.accounts = accounts;
  };

  getSignature = (): Promise<string> => {
    if (window.localStorage.getItem(`__CARGO_SIG__${this.cargo.accounts[0]}`)) {
      return Promise.resolve(
        window.localStorage.getItem(`__CARGO_SIG__${this.cargo.accounts[0]}`),
      );
    }
    return new Promise((resolve, reject) => {
      this.cargo.web3.eth.personal.sign(
        signingMessage,
        this.accounts[0],
        // @ts-ignore
        (err: Error, result: any) => {
          if (err) return reject(new Error(err.message));
          if (result.error) {
            return reject(new Error(result.error.message));
          }
          window.localStorage.setItem(
            `__CARGO_SIG__${this.cargo.accounts[0]}`,
            result,
          );
          resolve(result);
        },
      );
    });
  };

  private isEnabledAndHasProvider = async () => {
    if (!this.cargo.enabled) {
      await this.cargo.enable();
    }
    if (!this.cargo.hasProvider) {
      throw new Error('Provider required');
    }
  };

  providerMethod = <T extends any[], F extends Function>(fn: F) => async (
    ...args: T
  ) => {
    await this.isEnabledAndHasProvider();
    return fn(...args);
  };

  private sendTx = (options: Record<string, unknown>) =>
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
  authenticatedMethod = <T extends any[], F extends Function>(fn: F) => async (
    ...args: T
  ): Promise<ReturnType<(...args: any) => any>> => {
    this.checkForToken();
    return fn(...args);
  };

  checkForToken = () => {
    if (!this.token) {
      throw new Error('authentication-required');
    }
  };

  public isUnlockable = async (
    contractAddress: string,
    collectibleId: string,
  ) => {
    return this.request<{ unlockable: boolean }, any>('/v3/unlockable', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contractAddress,
        tokenId: collectibleId,
      }),
    });
  };

  public download = this.providerMethod(
    async (contractAddress: string, tokenId: string) => {
      const message = `${contractAddress}:${tokenId}`;

      const p = () =>
        new Promise((resolve, reject) => {
          this.cargo.web3.eth.personal.sign(
            message,
            this.accounts[0],
            // @ts-ignore
            (err: Error, result: any) => {
              if (err) return reject(new Error(err.message));
              if (result.error) {
                return reject(new Error(result.error.message));
              }
              resolve(result);
            },
          );
        });

      const signature = await p();

      return this.request<{ url: string }, any>('/v3/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature,
          tokenId,
          contractAddress,
        }),
      });
    },
  );

  private _bulkMetadataUpdate = async (
    contractAddress: string,
    metadata: {
      [tokenId: string]: Object;
    },
  ) => {
    return this.request('/v3/bulk-metadata-update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        contractAddress,
        metadata,
      }),
    });
  };

  public bulkMetadataUpdate = this.authenticatedMethod<
    [
      string,
      {
        [tokenId: string]: Object;
      }
    ],
    CargoApi['_bulkMetadataUpdate']
  >(this._bulkMetadataUpdate);

  public addCollectiblesToShowcase = async (
    items: Record<string, string[]>,
    showcaseId,
  ) => {
    this.checkForToken();
    return this.request<{ success: true }, any>(`/v3/showcase/add-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ items, showcaseId }),
    });
  };

  public removeCollectiblesFromShowcase = async (
    items: Record<string, string[]>,
    showcaseId,
  ) => {
    this.checkForToken();
    return this.request<{ success: true }, any>(`/v3/showcase/remove-items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ items, showcaseId }),
    });
  };

  public getUserTokensByContract = async (
    options: GetUserTokensByContractParams,
  ) => {
    if (!options || !options.contractId) {
      throw new Error('Missing contract ID');
    }
    const query = new URLSearchParams('');
    if (options.limit) {
      query.append('limit', options.limit);
    }
    if (options.page) {
      query.append('page', options.page);
    }
    if (options.address) {
      query.append('address', options.address);
    }
    const queryStr = query.toString();
    return this.request<
      PaginationResponseWithResults<GetUserTokensByContractRespose[]>,
      any
    >(
      `/v3/get-user-tokens/${options.contractId}${query ? `?${queryStr}` : ''}`,
      {
        headers: options.skipAuth
          ? {}
          : { Authorization: `Bearer ${this.token}` },
      },
    );
  };

  getAllShowcaseItems = async (
    showcaseId: string,
    page: string,
    limit: string,
  ) => {
    const params = new URLSearchParams('');
    if (page) {
      params.set('page', page);
    }

    if (limit) {
      params.set('limit', limit);
    }

    if (!showcaseId) {
      throw new Error('getAllShowcaseItems: Showcase ID required');
    }

    const query = params.toString();

    return this.request<PaginationResponseWithResults<ShowcaseItem[]>, any>(
      `/v3/showcase/all/${showcaseId}${query ? `?${query}` : ''}`,
    );
  };

  getShowcaseItemsForSale = async (options: {
    page?: string;
    limit?: string;
    showcaseId: string;
    sort?: 'new' | 'high-to-low' | 'low-to-high';
    filter?: {
      containsGem?: boolean;
      builtOnCargo?: boolean;
      threed?: boolean;
      audio?: boolean;
      video?: boolean;
      image?: boolean;
    };
  }) => {
    if (!options) {
      throw new Error('getShowcaseItemsForSale: Options required');
    }
    if (!options.showcaseId) {
      throw new Error('getShowcaseItemsForSale: Showcase ID required');
    }
    const params = new URLSearchParams('');
    if (options.filter) {
      params.set('filter', JSON.stringify(options.filter));
    }
    if (options.sort) {
      params.set('sort', options.sort);
    }
    if (options.limit) {
      params.set('limit', options.limit);
    }
    if (options.page) {
      params.set('page', options.page);
    }
    const query = params.toString();
    return this.request(
      `/v3/showcase/for-sale/${options.showcaseId}${query ? `?${query}` : ''}`,
    );
  };

  getCurrencies = async () => {
    return this.request('/v4/currencies');
  };

  getCurrencyIdByAddress = async address => {
    return this.request(`v4/currency-by-address/${address}`);
  };

  getResaleItems = async (options: {
    showcaseId?: string;
    seller?: string;
    chain?: Chain;
    collectionId?: string;
    collectionAddress?: string;
    page?: string;
    limit?: string;
    owned?: string;
    // If slug is present slug id is required
    slug?: string;
    slugId?: string;
    // default sort is by popularity
    sort?: 'new' | 'high-to-low' | 'low-to-high';
    filter: {
      containsGem?: boolean;
      builtOnCargo?: boolean;
      threed?: boolean;
      audio?: boolean;
      video?: boolean;
      image?: boolean;
      currency?: Array<'ether' | TCurrencyAddress>;
    };
  }) => {
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
    };

    const {
      page,
      limit,
      showcaseId,
      collectionId,
      owned,
      slug,
      slugId,
      collectionAddress,
      sort,
      filter,
      chain,
      seller,
    } = options || {};

    if (owned && !this.token) {
      throw new Error(
        'Must be authenticated when requesting owned resale items',
      );
    }

    if (owned && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let query = '';

    if (sort) {
      query = addToQuery(query, `sort=${sort}`);
    }

    if (seller) {
      query = addToQuery(query, `seller=${seller}`);
    }

    if (chain) {
      query = addToQuery(query, `chain=${chain}`);
    }

    if (filter) {
      try {
        query = addToQuery(query, `filter=${JSON.stringify(filter)}`);
      } catch (e) {
        throw new Error('Cargo JS: filter must be an object');
      }
    }

    if (page) {
      query = addToQuery(query, `page=${page}`);
    }

    if (limit) {
      query = addToQuery(query, `limit=${limit}`);
    }

    if (collectionId) {
      query = addToQuery(query, `contractId=${collectionId}`);
    }

    if (showcaseId) {
      query = addToQuery(query, `crateId=${showcaseId}`);
    }

    if (collectionAddress) {
      query = addToQuery(query, `collectionAddress=${collectionAddress}`);
    }

    if (slug && slugId) {
      query = addToQuery(query, `slug=${slug}&slugId=${slugId}`);
    }

    return this.request(`/v3/get-resale-items${query}`, {
      headers,
    });
  };

  getShowcaseBySlug = async (
    slug: string,
    slugId: string,
  ): TResp<GetShowcaseByIdResponse, any> => {
    return this.request(`/v3/get-crate-by-id/${slug}?slugId=${slugId}`);
  };

  getShowcaseById = async (
    showcaseId: string,
    auth: boolean,
  ): TResp<GetShowcaseByIdResponse, any> => {
    let headers;
    if (auth) {
      this.checkForToken();
      headers = {
        Authorization: `Bearer ${this.token}`,
      };
    }
    return this.request(`/v3/get-crate-by-id/${showcaseId}`, { headers });
  };

  getContracts = async (options: {
    page?: string;
    limit?: string;
    showcaseId?: string;
    address?: string;
    hasTokens?: boolean;
    owned?: boolean;
    cargoContract?: boolean;
    useAuthToken?: boolean;
    skipAuth?: true;
  }) => {
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
    };

    const {
      page,
      limit,
      showcaseId,
      owned,
      cargoContract,
      address,
      hasTokens,
      skipAuth,
    } = options || {};

    if (this.token && !skipAuth) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const params = new URLSearchParams(
      `?page=${page || '1'}&limit=${limit || '10'}`,
    );

    if (hasTokens) {
      params.set('hasTokens', 'true');
    }
    if (showcaseId) {
      params.set('crateId', showcaseId);
    }

    if (address) {
      params.set('address', address);
    }

    if (cargoContract) {
      params.set('cargoContract', 'true');
    }

    if (owned != null) {
      if (owned === true) {
        params.set('owned', 'true');
      }
      if (owned === false) {
        params.set('owned', 'false');
      }
    }

    if (options.useAuthToken) {
      params.set('useAuthToken', 'true');
    }

    return this.request<PaginationResponseWithResults<ContractV3>, any>(
      `/v3/get-contracts?${params.toString()}`,
      {
        headers,
      },
    );
  };

  public createShowcase = async (
    name: string,
    description = '',
    banner: File,
  ) => {
    const data = new FormData();
    data.append('name', name);
    data.append('description', description);
    if (banner) {
      data.append('file', banner);
    }
    return this.request<{ showcaseId: string }, any>('/v3/create-crate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: data,
    });
  };

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

    if (response.status === 200 && response.err === false) {
      const { token } = response.data;
      this.token = token;
      // localStorage.setItem(CARGO_LOCAL_STORAGE_TOKEN, token);
    }

    return response;
  });

  register = this.providerMethod(async (email?: string, username?: string) => {
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
          username,
        }),
      },
    );

    if (response.err === false) {
      const { token } = response.data;
      this.token = token;
      localStorage.setItem(CARGO_LOCAL_STORAGE_TOKEN, token);
    }
    return response;
  });

  estimateGas = async (m, params) => {
    const gasPrice = await fetch(
      'https://ethgasstation.info/api/ethgasAPI.json?api-key=7eb1f2d4c3e80bdf25b5385ab725e644819f3709af412e228a26f81e13d2',
    )
      .then(res => res.json())
      .then(json => {
        return json.fast / 10;
      });

    console.log(gasPrice, params);
    const estimatedGas = await m.estimateGas({
      gasPrice: this.cargo.web3.utils.toWei(
        new this.cargo.BigNumber(gasPrice).toFixed(),
        'gwei',
      ),
      ...params,
    });

    const additionalGas = new this.cargo.BigNumber(estimatedGas)
      .times(0.12)
      .toFixed(0);
    const finalGas = new this.cargo.BigNumber(estimatedGas)
      .plus(additionalGas)
      .toFixed();

    return {
      gas: finalGas,
      gasPrice: this.cargo.web3.utils.toWei(
        new this.cargo.BigNumber(gasPrice).toFixed(),
        'gwei',
      ),
    };
  };

  callTxAndPoll = (method: Function) => params =>
    new Promise(async (resolve, reject) => {
      try {
        if (this.cargo.estimateGas) {
          const gasParams = await this.estimateGas(method, params);
          params = {
            ...params,
            ...gasParams,
          };
        }
        method
          // @ts-ignore Ignore until we type the method as a web3 contract method
          .send(params)
          .once('transactionHash', hash => {
            this.cargo.pollTx.watch(hash);
            resolve(hash);
          })
          .once('error', e => {
            reject(e);
          });
      } catch (e) {
        reject(e);
      }
    });

  cancelSale = this.providerMethod(
    async (resaleItemId: string, web3TxParams?: any) => {
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
        ArgsResponse & { signatureGenerated?: boolean },
        any
      >('/v3/cancel-sale', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (response.err === true) {
        throw new Error(JSON.stringify(response));
      }

      const { args, signatureGenerated } = response.data;

      if (signatureGenerated) {
        const contract = await this.cargo.getContractInstance('cargoSell');
        return this.callTxAndPoll(contract.methods.cancelSale(...args))({
          from: this.cargo.accounts[0],
          ...web3TxParams,
        });
      } else {
        return response;
      }
    },
  );

  updateBeneficiaryCommission = this.providerMethod(
    this.authenticatedMethod(
      async (
        beneficiaryAddress: string,
        commission: number,
        crateId: string,
        web3TxParams?: any,
      ) => {
        const response = await this.request<ArgsResponse, any>(
          '/v3/update-beneficiary-commission',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({
              address: beneficiaryAddress,
              commission: this.cargo.getCommission(commission),
              crateId,
            }),
          },
        );

        if (response.err === true) {
          throw new Error(JSON.stringify(response));
        }

        const { args } = response.data;

        const contract = await this.cargo.getContractInstance('cargoVendor');

        return this.callTxAndPoll(
          contract.methods.updateBeneficiaryCommission(...args),
        )({
          from: this.cargo.accounts[0],
          ...web3TxParams,
        });
      },
    ),
  );

  getMintingCreditBalance = this.providerMethod(async () => {
    const contract = await this.cargo.getContractInstance(
      'cargoMintingCredits',
    );
    const balance = await contract.methods.balanceOf(this.accounts[0]).call();
    return new this.cargo.BigNumber(balance).div(10 ** 18).toFixed(4);
  });

  purchaseCreditPack = this.providerMethod(
    async (pack: string, price: string, web3TxParams?: any) => {
      const contract = await this.cargo.getContractInstance(
        'cargoMintingCredits',
      );

      return this.callTxAndPoll(contract.methods.purchaseBalance(pack))({
        from: this.cargo.accounts[0],
        value: price,
        ...web3TxParams,
      });
    },
  );

  addVendor = this.providerMethod(
    this.authenticatedMethod(
      async (vendorAddress: string, crateId: string, web3TxParams?: any) => {
        const response = await this.request<ArgsResponse, any>(
          '/v3/add-vendor',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({
              vendorAddress,
              crateId,
            }),
          },
        );

        if (response.err === true) {
          throw new Error(JSON.stringify(response));
        }

        const { args } = response.data;

        const contract = await this.cargo.getContractInstance('cargoVendor');

        return this.callTxAndPoll(contract.methods.addVendor(...args))({
          from: this.cargo.accounts[0],
          ...web3TxParams,
        });
      },
    ),
  );

  addBeneficiary = this.providerMethod(
    this.authenticatedMethod(
      async (
        crateId: string,
        beneficiaryAddress: string,
        commission: number,
        web3TxParams?: any,
      ) => {
        const isValidCommission = commission => 0 && commission <= 1;
        if (!isValidCommission) {
          throw new Error('Commission must be a number between 0 and 1');
        }
        const response = await this.request<ArgsResponse, any>(
          '/v3/add-beneficiary',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({
              crateId,
              address: beneficiaryAddress,
              commission: this.cargo.getCommission(commission),
            }),
          },
        );

        if (response.err === true) {
          throw new Error(JSON.stringify(response));
        }

        const { args } = response.data;

        const contract = await this.cargo.getContractInstance('cargoVendor');

        return this.callTxAndPoll(contract.methods.addBeneficiary(...args))({
          from: this.cargo.accounts[0],
          ...web3TxParams,
        });
      },
    ),
  );

  removeBeneficiary = this.providerMethod(
    this.authenticatedMethod(
      async (
        beneficiaryAddress: string,
        crateId: string,
        web3TxParams?: any,
      ) => {
        const response = await this.request<ArgsResponse, any>(
          '/v3/remove-beneficiary',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({
              beneficiaryAddress,
              crateId,
            }),
          },
        );

        if (response.err === true) {
          throw new Error(JSON.stringify(response));
        }

        const { args } = response.data;

        const contract = await this.cargo.getContractInstance('cargoVendor');

        return this.callTxAndPoll(contract.methods.removeBeneficiary(...args))({
          from: this.cargo.accounts[0],
          ...web3TxParams,
        });
      },
    ),
  );

  public getRoyalty = async (params: {
    contractAddress: string;
    tokenId: string;
  }) => {
    return this.request<{ royalty: Royalty }, any>('/v4/get-royalty', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
  };

  public addRoyalty = async (params: {
    contractAddress: string;
    tokenId: string;
    payees: string[];
    commissions: string[];
  }) => {
    this.checkForToken();

    return this.request<{ success: true }, any>('/v4/add-royalty', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(params),
    });
  };

  public createContract = async (
    name: string,
    network: Chain,
    symbol?: string,
    web3TxParams?: any,
  ) => {
    if (!network || !name) {
      throw new Error('Cargo JS - createContract: Invalid arguments');
    }
    await this.isEnabledAndHasProvider();
    this.checkForToken();

    const response = await this.request<ArgsResponse, any>(
      '/v5/create-contract',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          name,
          symbol,
        }),
      },
    );

    if (response.err === true) {
      throw new Error(JSON.stringify(response));
    }

    const { args } = response.data;

    const contract = await this.cargo.getContractInstance(
      'nftCreator',
      network,
    );

    return this.callTxAndPoll(contract.methods.createContract(...args))({
      from: this.cargo.accounts[0],
      ...web3TxParams,
    });
  };

  _orders = async (options?: OrderParams) => {
    return this.request<PaginationResponseWithResults<Order[]>, any>(
      `/v3/get-orders${options ? getQuery(options) : ''}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      },
    );
  };

  public orders = this.authenticatedMethod<[OrderParams], CargoApi['_orders']>(
    this._orders,
  );

  wizardMint = async (
    sessionId: string,
    contractAddress: string,
    toAddress: string,
    web3TxParams?: any,
  ) => {
    await this.isEnabledAndHasProvider();
    this.checkForToken();
    const res = await this.request<{ args: string[]; chain: Chain }, any>(
      '/v5/wizard/mint',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({ sessionId }),
      },
    );

    if (res.err === true) {
      throw new Error(JSON.stringify(res.errorData));
    }

    const contract = await this.cargo.getContractInstance(
      'cargoNft',
      res.data.chain,
      contractAddress,
    );

    const fn = contract.methods.batchMint(
      res.data.amount,
      toAddress,
      ...res.data.args,
    );

    return this.callTxAndPoll(fn)({
      from: this.cargo.accounts[0],
      ...web3TxParams,
    });
  };

  mint = this.providerMethod(
    async (
      {
        contractAddress,
        amount,
        to,
        name,
        description,
        metadata,
        previewImage,
        files,
        displayContent,
        method = 'batchMint',
      }: MintParams,
      web3TxParams?: any,
    ) => {
      this.checkForToken();
      const cargoData = await this.cargo.getContractInstance('cargoData');
      const isCargoContract = await cargoData.methods
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
      if (displayContent) {
        formData.append('displayContentType', displayContent.type);
        displayContent.files.forEach(file => {
          formData.append('displayContent', file);
        });
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

      if (response.err === true) {
        throw new Error(JSON.stringify(response));
      }

      const { args } = response.data;

      const contract = await this.cargo.getContractInstance(
        'cargoNft',
        contractAddress,
      );

      const fnArgs = [];

      if (method === 'mint') {
        fnArgs.push(to, ...args);
      } else {
        fnArgs.push(amount, to, ...args);
      }

      const fn = contract.methods[method](...fnArgs);

      return this.callTxAndPoll(fn)({
        from: this.cargo.accounts[0],
        ...web3TxParams,
      });
    },
  );

  transferCollectible = this.providerMethod(
    async (
      contractAddress: string,
      tokenId: string,
      to: string,
      magic?: boolean,
      web3TxParams?: any,
    ) => {
      if (magic) {
        const contract = await this.cargo.getContractInstance('magicMintUtil');
        const res = await this.request<{ args: string[] }, any>(
          '/v3/magic-transfer',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({
              to,
              tokenId,
              from: this.cargo.accounts[0],
            }),
          },
        );
        if (res.err === false) {
          return this.callTxAndPoll(
            contract.methods.transferToken(...res.data.args),
          )({ from: this.cargo.accounts[0], ...web3TxParams });
        }
      } else {
        const contract = await this.cargo.getContractInstance(
          'cargoNft',
          contractAddress,
        );
        return this.callTxAndPoll(
          contract.methods.safeTransferFrom(
            this.cargo.accounts[0],
            to,
            tokenId,
          ),
        )({ from: this.cargo.accounts[0], ...web3TxParams });
      }
    },
  );

  burnCollectible = this.providerMethod(
    async (contractAddress: string, tokenId: string, web3TxParams?: any) => {
      const contract = await this.cargo.getContractInstance(
        'cargoNft',
        contractAddress,
      );
      return this.callTxAndPoll(contract.methods.burn(tokenId))({
        from: this.cargo.accounts[0],
        ...web3TxParams,
      });
    },
  );

  purchase = async (saleId: string, chain: Chain) => {
    await this.isEnabledAndHasProvider();
    const response = await this.request<
      { args: string[]; web3Params: {} },
      any
    >('/v4/purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ saleId }),
    });

    if (response.err === false) {
      const contract = await this.cargo.getContractInstance(
        'orderExecutorV1',
        chain,
      );
      return this.callTxAndPoll(
        contract.methods.purchase(...response.data.args),
      )({
        from: this.accounts[0],
        ...response.data.web3Params,
      });
    }
  };

  deprecated_purchase = this.providerMethod(
    async (
      tokenId: string,
      contractAddress: string,
      magic?: boolean,
      web3TxParams?: any,
    ) => {
      const response = await this.request<
        ArgsResponse & { price: string },
        any
      >(magic ? '/v3/magic-purchase' : '/v3/purchase', {
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

      if (response.err === true) {
        throw new Error(JSON.stringify(response));
      }

      const { args, price } = response.data;

      if (magic) {
        const contract = await this.cargo.getContractInstance('magicMintUtil');
        return this.callTxAndPoll(contract.methods.magicPurchase(...args))({
          from: this.cargo.accounts[0],
          value: price,
          ...web3TxParams,
        });
      } else {
        const contract = await this.cargo.getContractInstance('cargoSell');

        const method =
          args[3] && args[3].length === 4 ? 'purchaseInCrate' : 'purchase';

        return this.callTxAndPoll(contract.methods[method](...args))({
          from: this.cargo.accounts[0],
          value: price,
          ...web3TxParams,
        });
      }
    },
  );

  sell = this.providerMethod(
    async (
      {
        chain,
        currencyId,
        contractAddress,
        tokenId,
        payees,
        commissions,
        price,
        magic,
      }: {
        chain: Chain;
        contractAddress: string;
        tokenId: string;
        price: string;
        crateId?: string;
        commissions?: number[];
        payees?: string[];
        currencyId?: string;
        magic?: boolean;
      },
      unapprovedFn?: () => void,
    ) => {
      this.checkForToken();
      const [sender] = this.cargo.accounts;
      const body: { [key: string]: any } = {
        sender,
        contractAddress,
        tokenId,
        payees,
        commissions,
        currencyId,
        price,
        magic,
      };

      const contract = await this.cargo.getContractInstance(
        'cargoNft',
        chain,
        contractAddress,
      );

      const returnVal = async () => {
        const headers: { [key: string]: string } = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        };

        return this.request('/v4/sell', {
          method: 'POST',
          body: JSON.stringify(body),
          headers,
        });
      };

      if (magic) {
        const owner = await contract.methods.ownerOf(tokenId).call();
        const creator = await contract.methods.creator().call();

        if (owner === creator) {
          return returnVal();
        }
      }

      const { address: orderExecutorV1 } = await this.cargo.getContract(
        'orderExecutorV1',
        chain,
      );

      const isApproved = await contract.methods
        .isApprovedForAll(sender, orderExecutorV1)
        .call();

      if (!isApproved) {
        if (unapprovedFn) {
          unapprovedFn();
        }
        await contract.methods.setApprovalForAll(orderExecutorV1, true).send({
          from: this.accounts[0],
        });
      }
      return returnVal();
    },
  );

  deleteShowcase = this.authenticatedMethod(async (showcaseId?: string) => {
    return this.request<{ code: 'success' }, any>(
      `/v3/delete-showcase?showcaseId=${showcaseId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      },
    );
  });

  public modifyShowcase = async (
    showcaseId,
    update: {
      name?: string;
      description?: string;
      file?: File;
    },
  ) => {
    this.checkForToken();
    const data = new FormData();
    if (!update) {
      throw new Error('modifyShowcase: update argument required');
    }

    const { name, description, file } = update;

    if (name) {
      data.append('name', name);
    }

    if (description) {
      data.append('description', description);
    }

    if (file) {
      data.append('file', file);
    }

    return this.request<
      {
        _id: string;
        name: string;
        owner: string;
        description: string;
        banner: string;
        bannerUrl: string;
      },
      any
    >(`/v3/modify-showcase/${showcaseId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: data,
    });
  };

  removeVendor = this.providerMethod(
    this.authenticatedMethod(
      async (vendorAddress: string, crateId: string, web3TxParams?: any) => {
        const response = await this.request<ArgsResponse, any>(
          '/v3/remove-vendor',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify({
              vendorAddress,
              crateId,
            }),
          },
        );

        if (response.err === true) {
          throw new Error(JSON.stringify(response));
        }

        const { args } = response.data;

        const contract = await this.cargo.getContractInstance('cargoVendor');

        return this.callTxAndPoll(contract.methods.removeVendor(...args))({
          from: this.cargo.accounts[0],
          ...web3TxParams,
        });
      },
    ),
  );

  private _getVendorBeneficiaries = async (
    vendorAddress: string,
    crateId: string,
  ) => {
    return this.request<
      PaginationResponseWithResults<VendorBeneficiaryV3>,
      any
    >(`/v3/get-vendor-beneficiaries/${crateId}/${vendorAddress}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
    });
  };

  public getVendorBeneficiaries = this.authenticatedMethod<
    [string, string],
    CargoApi['_getVendorBeneficiaries']
  >(this._getVendorBeneficiaries);

  private _getIndexStatus = async () =>
    this.request<{ indexed: boolean }, any>('/v3/get-index-status', {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

  public getIndexStatus = this.authenticatedMethod<
    [],
    CargoApi['_getIndexStatus']
  >(this._getIndexStatus);

  private _getShowcaseVendors = async (
    crateId: string,
    page: string,
    limit: string,
  ) => {
    let query = '';
    if (page) {
      query = addToQuery(query, `page=${page}`);
    }
    if (limit) {
      query = addToQuery(query, `limit=${limit}`);
    }
    return this.request<PaginationResponseWithResults<CrateVendorV3>, any>(
      `/v3/get-crate-vendors/${crateId}${query}`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
      },
    );
  };

  public getShowcaseVendors = this.authenticatedMethod<
    [string, string, string],
    CargoApi['_getShowcaseVendors']
  >(this._getShowcaseVendors);

  public getAllUserCollectibles = async ({
    page = '1',
    limit = '10',
    address,
  }) => {
    const params = new URLSearchParams('');
    params.set('page', page);
    params.set('limit', limit);
    const query = params.toString();
    return this.request<PaginationResponseWithResults<any>, any>(
      `/v3/all-collectibles/${address}${query ? `?${query}` : ''}`,
    );
  };

  public getUserShowcases = async ({
    page,
    limit,
    account,
    useAuth = true,
  }: GetUserShowcaseArgs = {}) => {
    let query = '';
    if (page) {
      query = addToQuery(query, `page=${page}`);
    }

    if (limit) {
      query = addToQuery(query, `limit=${limit}`);
    }

    if (account) {
      query = addToQuery(query, `account=${account}`);
    }

    let params = {};

    if (useAuth) {
      params = {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      };
    }
    return this.request<PaginationResponseWithResults<UserCrateV3[]>, any>(
      `/v3/get-user-crates${query}`,
      params,
    );
  };

  public getTokenDetails = async (contractAddress: string, tokenId: string) => {
    return this.request<TokenDetail, any>(
      `/v3/get-token-details/${contractAddress}/${tokenId}`,
    );
  };

  public getCollectibleCreator = async (
    contractAddress: string,
    tokenId: string,
  ) => {
    return this.request<{ createdBy: string; creatorAddress: string }, any>(
      `/v3/get-collectible-creator/${contractAddress}/${tokenId}`,
    );
  };

  public getTokensByContract = async ({
    contractAddress,
    ownerAddress,
    page,
    limit,
  }: {
    contractAddress: string;
    ownerAddress?: string;
    page?: string;
    limit?: string;
  }) => {
    let query = '';

    if (page) {
      query = addToQuery(query, `page=${page}`);
    }

    if (limit) {
      query = addToQuery(query, `limit=${limit}`);
    }

    if (ownerAddress) {
      query = addToQuery(query, `ownerAddress=${ownerAddress}`);
    }

    return this.request<
      PaginationResponseWithResults<GetTokensByContractResponse>,
      any
    >(`/v3/get-tokens-by-contract/${contractAddress}${query}`);
  };

  private _getOrders = async (options: GetOrderParams) => {
    const query = getQuery(options);
    return this.request(`/v3/get-orders${query}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
  };

  public getOrders = this.authenticatedMethod<
    [GetOrderParams],
    CargoApi['_getOrders']
  >(this._getOrders);

  public getContractMetadata = async ({
    contractAddress,
    useAuth,
    slug,
    slugId,
  }: {
    contractAddress: string;
    useAuth?: boolean;
    slug?: string;
    slugId?: string;
  }) => {
    const headers: { [key: string]: any } = {};
    if (useAuth && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    let query = '';
    if (slug) {
      query = addToQuery(query, `slug=${slug}`);
    }
    if (slugId) {
      query = addToQuery(query, `slugId=${slugId}`);
    }
    return this.request<ContractMetadata, any>(
      `/v3/get-contract-metadata/${contractAddress}${query}`,
      { headers },
    );
  };

  public purchaseErc1155 = async (resaleItemId: string, web3TxParams?: any) => {
    await this.isEnabledAndHasProvider();
    const res = await this.request<
      {
        args: [
          string,
          string,
          string[],
          string[],
          string,
          [string, string, string],
          string
        ];
        values: { from: string; value: string };
      },
      unknown
    >(`/v3/1155/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ resaleItemId, sender: this.cargo.accounts[0] }),
    });
    if (res.err === false) {
      const contract = await this.cargo.getContractInstance('cargoSell');
      return this.callTxAndPoll(
        contract.methods.erc1155Purchase(...res.data.args),
      )({ ...res.data.values, ...web3TxParams });
    } else {
      return res;
    }
  };

  public sellErc1155 = async (
    {
      ids,
      values,
      showcaseId,
      price, // wei
      contractAddress,
    }: {
      ids: string[];
      values: string[];
      price: string;
      showcaseId?: string;
      contractAddress: string;
    },
    unapprovedFn: () => any,
  ) => {
    await this.isEnabledAndHasProvider();

    const { address: cargoSellAddress } = await this.cargo.getContract(
      'cargoSell',
    );

    const contract = await this.cargo.getContractInstance(
      'erc1155',
      contractAddress,
    );

    const isApproved = await contract.methods
      .isApprovedForAll(this.cargo.accounts[0], cargoSellAddress)
      .call();

    if (!isApproved) {
      if (unapprovedFn) {
        unapprovedFn();
      }
      await contract.methods.setApprovalForAll(cargoSellAddress, true).send({
        from: this.accounts[0],
      });
    }

    const body: SellErc1155Body = {
      contractAddress,
      price,
      ids,
      crateId: showcaseId,
      values,
      sender: this.cargo.accounts[0],
    };

    const headers: Record<string, unknown> = {
      'Content-Type': 'application/json',
    };

    if (!this.token) {
      body.signature = await this.getSignature();
    } else {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return this.request(`/v3/1155/sell`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
  };

  public approveErc20 = async (
    amount: string,
    address: string,
    operator: string,
    web3TxParams?: any,
  ) => {
    const erc20 = await this.cargo.getContractInstance('erc20', address);
    return this.callTxAndPoll(erc20.methods.approve(operator, amount))({
      from: this.cargo.accounts[0],
      ...web3TxParams,
    });
  };

  public approveGems = async (amount: string, web3TxParams?: any) => {
    const staking = await this.cargo.getContract('cargoGemsStaking');
    const gems = await this.cargo.getContractInstance('cargoGems');
    return this.callTxAndPoll(gems.methods.approve(staking.address, amount))({
      from: this.cargo.accounts[0],
      ...web3TxParams,
    });
  };

  public stakeGems = async (
    contractAddress: string,
    tokenId: string,
    amount: string,
    web3TxParams?: any,
  ) => {
    const staking = await this.cargo.getContractInstance('cargoGemsStaking');
    return this.callTxAndPoll(
      staking.methods.stake(contractAddress, tokenId, amount),
    )({ from: this.cargo.accounts[0], ...web3TxParams });
  };

  public getStakedTokens = async (address: string) => {
    return this.request<StakedTokensResponse, any>(
      `/v3/staked-tokens/${address}`,
    );
  };

  public claimAndStakeRewards = async (
    address: string,
    tokenId: string,
    web3TxParams?: any,
  ) => {
    const res = await this.request<ArgsResponse, any>(
      `/v3/claim/${address}/${tokenId}`,
    );
    if (res.err === false) {
      const staking = await this.cargo.getContractInstance('cargoGemsStaking');
      return this.callTxAndPoll(staking.methods.claim(...res.data.args))({
        from: this.cargo.accounts[0],
        ...web3TxParams,
      });
    } else {
      throw new Error(JSON.stringify(res));
    }
  };

  public batchClaimAndStakeRewards = async (
    data: {
      address: string;
      tokenId: string;
      web3TxParams?: any;
    }[],
  ) => {
    const batch = new this.cargo.web3.BatchRequest();

    await Promise.all(
      data.map(({ address, tokenId, web3TxParams }) => {
        const fn = async () => {
          const res = await this.request<ArgsResponse, any>(
            `/v3/claim/${address}/${tokenId}`,
          );
          if (res.err === false) {
            const staking = await this.cargo.getContractInstance(
              'cargoGemsStaking',
            );
            batch.add(
              staking.methods.claim(...res.data.args).send.request({
                from: this.cargo.accounts[0],
                ...web3TxParams,
              }),
            );
          }
        };
        return fn();
      }),
    );
    batch.execute();
  };

  public withdraw = async (
    address: string,
    tokenId: string,
    amount: string,
    web3TxParams?: any,
  ) => {
    const res = await this.request<ArgsResponse, any>(
      `/v3/claim/${address}/${tokenId}?amount=${amount}`,
    );
    if (res.err === false) {
      const staking = await this.cargo.getContractInstance('cargoGemsStaking');
      return this.callTxAndPoll(staking.methods.claim(...res.data.args))({
        from: this.cargo.accounts[0],
        ...web3TxParams,
      });
    } else {
      throw new Error(JSON.stringify(res));
    }
  };

  public getTokenStake = async (address: string, tokenId: string) => {
    const res = await this.request<{ balance: string }, any>(
      `/v3/stake/${address}/${tokenId}`,
    );

    if (res.err === true) {
      throw new Error(JSON.stringify(res));
    }

    return res.data.balance;
  };

  public registerWallet = async (walletId: string, chain: Chain) => {
    const signature = await this.getSignature();
    return this.request(`/v5/register-wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chain,
        walletId,
        signature,
      }),
    });
  };
}
