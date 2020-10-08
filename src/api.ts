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
  ShowcaseId,
  CreateConsecutiveSaleParams,
  ConsecutivePurchaseParams,
  ConsecutivePurchaseReturn,
  SellErc1155Body,
  StakedTokensResponse,
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

  public addCollectionToShowcase = async (params: {
    contractId?: string;
    crateId: string;
    contractAddress?: string;
  }) => {
    this.checkForToken();
    return this.request<{ success: true }, any>('/v3/add-contract-to-crate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        crateId: params.crateId,
        contractId: params.contractId,
        contractAddress: params.contractAddress,
      }),
    });
  };

  private _getUserTokensByContract = async (
    options: GetUserTokensByContractParams,
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
      headers: { Authorization: `Bearer ${this.token}` },
    });
  };

  public getUserTokensByContract = this.authenticatedMethod<
    [GetUserTokensByContractParams],
    CargoApi['_getUserTokensByContract']
  >(this._getUserTokensByContract);

  getResaleItems = async (options: {
    showcaseId?: string;
    collectionId?: string;
    collectionAddress?: string;
    page?: string;
    limit?: string;
    owned?: string;
    // If slug is present slug id is required
    slug?: string;
    slugId?: string;
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
    owned?: boolean;
    cargoContract?: boolean;
    useAuthToken?: boolean;
  }) => {
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
    };

    const { page, limit, showcaseId, owned, cargoContract } = options || {};

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let query = `?page=${page || '1'}&limit=${limit || '10'}`;

    if (showcaseId) {
      query += `&crateId=${showcaseId}`;
    }

    if (cargoContract) {
      query += `&cargoContract=true`;
    }

    if (owned != null) {
      if (owned === true) {
        query += '&owned=true';
      }
      if (owned === false) {
        query += '&owned=false';
      }
    }

    if (options.useAuthToken) {
      query = addToQuery(query, 'useAuthToken=true');
    }

    return this.request<PaginationResponseWithResults<ContractV3>, any>(
      `/v3/get-contracts${query}`,
      {
        headers,
      },
    );
  };

  private _createShowcase = async (crateName: string) => {
    const response = await this.request<{ showcaseId: string }, any>(
      '/v3/create-crate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          name: crateName,
        }),
      },
    );

    return response;
  };

  public createShowcase = this.authenticatedMethod<
    [string],
    CargoApi['_createShowcase']
  >(this._createShowcase);

  private _LAB_createConsecutiveSale = async (
    params: CreateConsecutiveSaleParams,
    unapprovedFn?: () => void,
  ) => {
    const { address: cargoSellAddress } = await this.cargo.getContract(
      'cargoSell',
    );
    const contract = await this.cargo.getContractInstance(
      'cargoNft',
      params.contractAddress,
    );

    const isApproved = await contract.methods
      .isApprovedForAll(this.accounts[0], cargoSellAddress)
      .call();

    if (!isApproved) {
      if (unapprovedFn) {
        unapprovedFn();
      }
      await contract.methods.setApprovalForAll(cargoSellAddress, true).send({
        from: this.accounts[0],
      });
    }

    return this.request<
      {
        _id: string;
        seller: string;
        contract: string;
        pricePerItem: string;
        toTokenId: string;
        balance: string;
        crate: string;
      },
      any
    >('/v3/create-consecutive-sale', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(params),
    });
  };

  LAB_createConsecutiveSale = this.providerMethod<
    [CreateConsecutiveSaleParams, () => void],
    CargoApi['_LAB_createConsecutiveSale']
  >(this.authenticatedMethod(this._LAB_createConsecutiveSale));

  private _LAB_consecutivePurchase = async (
    params: ConsecutivePurchaseParams,
  ) => {
    const response = await this.request<ConsecutivePurchaseReturn, any>(
      `/v3/consecutive-purchase`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      },
    );

    if (response.err === false) {
      const contract = await this.cargo.getContractInstance('cargoSell');
      const args = response.data.slice(0, response.data.length - 1);
      const sendParams = response.data[response.data.length - 1];
      return this.callTxAndPoll(
        contract.methods.consecutivePurchaseInCrate(...args).send,
      )(sendParams);
    } else {
      throw new Error(JSON.stringify(response.errorData));
    }
  };

  LAB_consecutivePurchase = this.providerMethod<
    [ConsecutivePurchaseParams],
    CargoApi['_LAB_consecutivePurchase']
  >(this._LAB_consecutivePurchase);

  private _getShowcaseApplicationFee = async (showcaseId: string) => {
    const cargoData = await this.cargo.getContractInstance('cargoData');
    return cargoData.methods
      .crateApplicationFee(this.cargo.web3.utils.utf8ToHex(showcaseId))
      .call();
  };

  getShowcaseApplicationFee = this.providerMethod<
    [ShowcaseId],
    CargoApi['_getShowcaseApplicationFee']
  >(this._getShowcaseApplicationFee);

  setShowcaseApplicationFee = this.providerMethod(
    this.authenticatedMethod(async (fee: number, crateId: string) => {
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
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify({
            fee,
            crateId,
          }),
        },
      );

      if (response.err === true) {
        throw new Error(JSON.stringify(response));
      }

      const { args } = response.data;

      const contract = await this.cargo.getContractInstance('cargoSell');

      return this.callTxAndPoll(
        contract.methods.setCrateApplicationFee(...args).send,
      )({
        from: this.cargo.accounts[0],
      });
    }),
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

    if (response.status === 200 && response.err === false) {
      const { token } = response.data;
      this.token = token;
      // localStorage.setItem(CARGO_LOCAL_STORAGE_TOKEN, token);
    }

    return response;
  });

  register = this.providerMethod(async (email: string, username: string) => {
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

  callTxAndPoll = (method: Function) => (...args: any[]) =>
    new Promise((resolve, reject) => {
      method(...args)
        .once('transactionHash', hash => {
          this.cargo.pollTx.watch(hash);
          resolve(hash);
        })
        .once('error', e => {
          reject(e);
        });
    });

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
        commission: number,
        crateId: string,
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
          contract.methods.updateBeneficiaryCommission(...args).send,
        )({
          from: this.cargo.accounts[0],
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
    async (pack: string, price: string) => {
      const contract = await this.cargo.getContractInstance(
        'cargoMintingCredits',
      );

      return this.callTxAndPoll(contract.methods.purchaseBalance(pack).send)({
        from: this.cargo.accounts[0],
        value: price,
      });
    },
  );

  addVendor = this.providerMethod(
    this.authenticatedMethod(async (vendorAddress: string, crateId: string) => {
      const response = await this.request<ArgsResponse, any>('/v3/add-vendor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          vendorAddress,
          crateId,
        }),
      });

      if (response.err === true) {
        throw new Error(JSON.stringify(response));
      }

      const { args } = response.data;

      const contract = await this.cargo.getContractInstance('cargoVendor');

      return this.callTxAndPoll(contract.methods.addVendor(...args).send)({
        from: this.cargo.accounts[0],
      });
    }),
  );

  addBeneficiary = this.providerMethod(
    this.authenticatedMethod(
      async (
        crateId: string,
        beneficiaryAddress: string,
        commission: number,
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
      async (beneficiaryAddress: string, crateId: string) => {
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

        return this.callTxAndPoll(
          contract.methods.removeBeneficiary(...args).send,
        )({
          from: this.cargo.accounts[0],
        });
      },
    ),
  );

  private _createContract = async (
    name: string,
    symbol?: string,
    crateId?: string,
  ) => {
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

    if (response.err === true) {
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

  public createContract = this.providerMethod<
    [string, string?, string?],
    CargoApi['_createContract']
  >(this._createContract);

  mint = this.providerMethod(
    async ({
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
    }: MintParams) => {
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

      return this.callTxAndPoll(fn.send)({ from: this.cargo.accounts[0] });
    },
  );

  transferCollectible = this.providerMethod(
    async (
      contractAddress: string,
      tokenId: string,
      to: string,
      magic?: boolean,
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
            contract.methods.transferToken(...res.data.args).send,
          )({ from: this.cargo.accounts[0] });
        }
      } else {
        const contract = await this.cargo.getContractInstance(
          'cargoNft',
          contractAddress,
        );
        return this.callTxAndPoll(
          contract.methods.safeTransferFrom(this.cargo.accounts[0], to, tokenId)
            .send,
        )({ from: this.cargo.accounts[0] });
      }
    },
  );

  burnCollectible = this.providerMethod(
    async (contractAddress: string, tokenId: string) => {
      const contract = await this.cargo.getContractInstance(
        'cargoNft',
        contractAddress,
      );
      return this.callTxAndPoll(contract.methods.burn(tokenId).send)({
        from: this.cargo.accounts[0],
      });
    },
  );

  purchase = this.providerMethod(
    async (tokenId: string, contractAddress: string, magic?: boolean) => {
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
        return this.callTxAndPoll(contract.methods.magicPurchase(...args).send)(
          {
            from: this.cargo.accounts[0],
            value: price,
          },
        );
      } else {
        const contract = await this.cargo.getContractInstance('cargoSell');

        const method =
          args[3] && args[3].length === 4 ? 'purchaseInCrate' : 'purchase';

        return this.callTxAndPoll(contract.methods[method](...args).send)({
          from: this.cargo.accounts[0],
          value: price,
        });
      }
    },
  );

  sell = this.providerMethod(
    async (
      {
        contractAddress,
        tokenId,
        price,
        crateId,
        magic,
      }: {
        contractAddress: string;
        tokenId: string;
        price: string;
        crateId?: string;
        magic?: boolean;
      },
      unapprovedFn?: () => void,
    ) => {
      const [sender] = this.cargo.accounts;
      const body: { [key: string]: string | boolean } = {
        sender,
        contractAddress,
        tokenId,
        price,
        crateId,
        magic,
      };

      // if magic
      // check if owner is creator

      const contract = await this.cargo.getContractInstance(
        'cargoNft',
        contractAddress,
      );

      const returnVal = async () => {
        const headers: { [key: string]: string } = {
          'Content-Type': 'application/json',
        };
        if (!this.token) {
          body.signature = await this.getSignature();
        } else {
          headers.Authorization = `Bearer ${this.token}`;
        }

        return this.request('/v3/sell', {
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

      const { address: cargoSellAddress } = await this.cargo.getContract(
        'cargoSell',
      );

      const isApproved = await contract.methods
        .isApprovedForAll(sender, cargoSellAddress)
        .call();

      if (!isApproved) {
        if (unapprovedFn) {
          unapprovedFn();
        }
        await contract.methods.setApprovalForAll(cargoSellAddress, true).send({
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

  modifyShowcase = this.authenticatedMethod(
    async (
      showcaseId: string,
      update: { isPublic?: boolean; resellingEnabled?: boolean; name?: string },
    ) => {
      return this.request<
        {
          _id: string;
          name: string;
          owner: string;
          public: boolean;
        },
        any
      >(`/v3/modify-showcase/${showcaseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(update),
      });
    },
  );

  removeVendor = this.providerMethod(
    this.authenticatedMethod(async (vendorAddress: string, crateId: string) => {
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

      return this.callTxAndPoll(contract.methods.removeVendor(...args).send)({
        from: this.cargo.accounts[0],
      });
    }),
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

  private _getUserShowcases = async ({
    page,
    limit,
  }: GetUserShowcaseArgs = {}) => {
    let query = '';
    if (page) {
      query = addToQuery(query, `page=${page}`);
    }

    if (limit) {
      query = addToQuery(query, `limit=${limit}`);
    }
    return this.request<PaginationResponseWithResults<UserCrateV3>, any>(
      `/v3/get-user-crates${query}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      },
    );
  };

  public getUserShowcases = this.authenticatedMethod<
    [GetUserShowcaseArgs],
    CargoApi['_getUserShowcases']
  >(this._getUserShowcases);

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

  public purchaseErc1155 = async (resaleItemId: string) => {
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
        contract.methods.erc1155Purchase(...res.data.args).send,
      )(res.data.values);
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

  public approveGems = async (amount: string) => {
    const staking = await this.cargo.getContract('cargoGemsStaking');
    const gems = await this.cargo.getContractInstance('cargoGems');
    return this.callTxAndPoll(
      gems.methods.approve(staking.address, amount).send,
    )({ from: this.cargo.accounts[0] });
  };

  public stakeGems = async (
    contractAddress: string,
    tokenId: string,
    amount: string,
  ) => {
    const staking = await this.cargo.getContractInstance('cargoGemsStaking');
    return this.callTxAndPoll(
      staking.methods.stake(contractAddress, tokenId, amount).send,
    )({ from: this.cargo.accounts[0] });
  };

  public getStakedTokens = async (address: string) => {
    return this.request<StakedTokensResponse, any>(
      `/v3/staked-tokens/${address}`,
    );
  };

  public claimAndStakeRewards = async (address, tokenId) => {
    const res = await this.request<ArgsResponse, any>(
      `/v3/claim/${address}/${tokenId}`,
    );
    if (res.err === false) {
      const staking = await this.cargo.getContractInstance('cargoGemsStaking');
      return this.callTxAndPoll(staking.methods.claim(...res.data.args).send)({
        from: this.cargo.accounts[0],
      });
    } else {
      throw new Error(JSON.stringify(res));
    }
  };

  public withdraw = async (address, tokenId, amount) => {
    const res = await this.request<ArgsResponse, any>(
      `/v3/claim/${address}/${tokenId}?amount=${amount}`,
    );
    if (res.err === false) {
      const staking = await this.cargo.getContractInstance('cargoGemsStaking');
      return this.callTxAndPoll(staking.methods.claim(...res.data.args).send)({
        from: this.cargo.accounts[0],
      });
    } else {
      throw new Error(JSON.stringify(res));
    }
  };
}
