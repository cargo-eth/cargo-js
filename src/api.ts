import Cargo, { Contracts, ContractNames } from './cargo';
import { TokenAddress, TokenId } from './types';

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

  constructor(contracts: Contracts, requestUrl: string, cargo: Cargo) {
    this.requestUrl = requestUrl;
    this.contracts = contracts;
    this.cargo = cargo;
    this.request = cargo.request;
  }

  setAccounts = (accounts: Array<string>) => {
    this.accounts = accounts;
  };

  // Methods that do not require metamask
  getBeneficiaryBalance = (beneficiaryId: string) =>
    this.request(`/v1/get-beneficiary-balance/${beneficiaryId}`);

  getBeneficiaryById = (beneficiaryId: string) =>
    this.request(`/v1/get-beneficiary-by-id/${beneficiaryId}`);

  getBeneficiaryVendor = (beneficiaryId: string) =>
    this.request(`/v1/get-beneficiary-vendor/${beneficiaryId}`);

  getContract = (contract: ContractNames) =>
    this.request(`/v1/get-contract/${contract}`);

  getCrateById = (crateId: string) =>
    this.request(`/v1/get-crate-by-id/${crateId}`);

  getVendorByTokenId = (tokenId: string) =>
    this.request(`/v1/get-vendor-by-token-id/${tokenId}`);

  getCrateVendors = (crateId: string) =>
    this.request(`/v1/get-crate-vendors/${crateId}`);

  getOwnedResaleItemsByCrateId = (crateId: string, address: string) =>
    this.request(
      `/v1/get-owned-resale-items-by-crate-id/${crateId}/${address}`,
    );

  getTokenMetadata = (tokenAddress: string, tokenId: string) =>
    this.request(`/v1/get-token-metadata/${tokenAddress}/${tokenId}`);

  getTokensMetadata = (tokens: [TokenAddress, TokenId[]]) =>
    this.request(
      `/v1/get-tokens-metadata`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokens,
        }),
      },
      true,
    );

  getMintedTokens = (tokenAddress: string, page?: string) =>
    this.request(
      `/v2/get-minted-tokens?tokenAddress=${tokenAddress}${
        page ? `&page=${page}` : ''
      }`,
    );

  getResellerBalance = (resellerAddress: string) =>
    this.request(`/v1/get-reseller-balance/${resellerAddress}`);

  getTokenContractById = (tokenContractId: string) =>
    this.request(`/v1/get-token-contract-by-id/${tokenContractId}`);

  getTokenContractByAddress = (tokenAddress: string) =>
    this.request(`/v1/get-token-contract-by-address/${tokenAddress}`);

  getVendorBeneficiaries = (vendorId: string) =>
    this.request(`/v1/get-vendor-beneficiaries/${vendorId}`);

  getVendorById = (vendorId: string) =>
    this.request(`/v1/get-vendor-by-id/${vendorId}`);

  getVendorCrate = (vendorId: string) =>
    this.request(`/v1/get-vendor-crate/${vendorId}`);

  getVendorTokenContracts = (vendorId: string) =>
    this.request(`/v1/get-vendor-token-contracts/${vendorId}`);

  getOwnedResaleItems = (address: string) =>
    this.request(`/v1/get-owned-resale-items/${address}`);

  getResaleItemsByCrateId = (crateId: string) =>
    this.request(`/v1/get-resale-items-by-crate-id/${crateId}`);

  getContractResaleItems = (contracts: Array<string>) =>
    this.request(
      `/v1/get-contract-resale-items?contractIds=${JSON.stringify(contracts)}`,
    );

  private requestMintAbi = (
    parameters: TMintParams & { signature: string; account: string },
  ) => {
    const formData = new FormData();
    const { files = [], previewImage, ...rest } = parameters;
    if (files.length > 0) {
      files.forEach(file => {
        formData.append('file', file);
      });
    }

    if (previewImage) {
      formData.append('previewImage', previewImage);
    }

    Object.keys(rest).forEach(key => {
      // @ts-ignore
      const value = rest[key];
      formData.append(key, value);
    });
    return this.request('/v1/mint', {
      method: 'POST',
      body: formData,
    });
  };

  /**
   * Get a paginated list of owned tokens for a given contract
   */
  getOwnedTokensByContract = async (
    ownerAddress: string,
    contractAddress: string,
    page?: string,
  ) =>
    this.request(
      `/v2/get-owned-tokens-by-contract/${ownerAddress}/${contractAddress}${
        page ? `?page=${page}` : ''
      }`,
    );

  /**
   * Get a list of contracts that a given address owns tokens in
   */
  getContractsWithStake = async (ownerAddress: string) =>
    this.request(`/v2/get-contracts-with-stake/${ownerAddress}`);

  getSignature = (): Promise<string> =>
    new Promise((resolve, reject) => {
      this.cargo.web3.personal.sign(
        `You agree that you are rightful owner of the current connected address.\n\n ${
          this.accounts[0]
        } \n\n Cargo will use this signature to verify your identity on our server.`,
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

  // 🦊
  mint = async (parameters: TMintParams) => {
    await this.isEnabledAndHasProvider();
    const {
      tokenAddress,
      vendorId,
      files,
      hasFiles,
      previewImage,
      name,
      description,
      metadata,
      batchMint,
      batchNumber,
      to,
    } = parameters;
    const signature = await this.getSignature();
    const res = await this.requestMintAbi({
      account: to || this.accounts[0],
      tokenAddress,
      hasFiles,
      files,
      previewImage,
      batchMint,
      batchNumber,
      name,
      description,
      signature,
      vendorId,
      metadata,
    });

    if (!res.err) {
      const {
        data: { abi },
      } = res;

      const tx = await this.sendTx({
        to: tokenAddress,
        data: abi,
        from: this.accounts[0],
      });

      return tx;
    } else {
      throw new Error(JSON.stringify(res));
    }
  };

  // 🦊
  cancelTokenSale = async (resaleItemId: string) => {
    await this.isEnabledAndHasProvider();

    const {
      cargoSell: { instance },
    } = this.contracts;

    // @ts-ignore
    const tx = await this.promisify(instance.cancelSale, resaleItemId, {
      from: this.accounts[0],
    });

    return tx;
  };

  // 🦊
  download = async (contractAddress: string, tokenId: string) => {
    await this.isEnabledAndHasProvider();
    const signature = await this.getSignature();
    return this.request('/v1/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signature,
        contractAddress,
        tokenId,
      }),
    });
  };

  // 🦊
  createBatchTokenContract = async (
    vendorId: string,
    tokenName: string,
    symbol: string,
  ) => {
    await this.isEnabledAndHasProvider();
    const {
      cargoTokenV2Creator: { instance: cargoTokenV2Creator },
      cargoAsset: { instance: cargoAsset },
    } = this.contracts;
    // @ts-ignore
    const price = await this.promisifyData(cargoAsset.PRICE.call, {
      from: this.accounts[0],
    });
    const tx = await this.promisify(
      // @ts-ignore
      cargoTokenV2Creator.createBatchTokenContract,
      vendorId,
      tokenName,
      symbol,
      {
        from: this.accounts[0],
        value: price,
      },
    );
  };

  // 🦊
  createTokenContract = async (
    vendorId: string,
    tokenContractName: string,
    symbol: string,
    limitedSupply: boolean,
    maxSupply: string,
  ) => {
    await this.isEnabledAndHasProvider();
    const {
      cargoTokenV1Creator: { instance },
    } = this.contracts;

    const tx = await this.promisify(
      // @ts-ignore
      instance.createTokenContract,
      vendorId,
      tokenContractName,
      symbol,
      limitedSupply,
      maxSupply,
      {
        from: this.accounts[0],
      },
    );

    return tx;
  };

  // 🦊
  addVendor = async (crateId: string, vendorAddress: string) => {
    await this.isEnabledAndHasProvider();
    const {
      cargoVendor: { instance },
    } = this.contracts;

    const tx = await this.promisify(
      // @ts-ignore
      instance.addVendor,
      crateId,
      vendorAddress,
      {
        from: this.accounts[0],
      },
    );

    return tx;
  };

  // 🦊
  publicAddVendor = async (crateId: string) => {
    await this.isEnabledAndHasProvider();
    const {
      cargoVendor: { instance },
    } = this.contracts;

    // @ts-ignore
    const tx = await this.promisify(instance.publicAddVendor, crateId, {
      from: this.accounts[0],
    });

    return tx;
  };

  // 🦊
  sellOwnedToken = async (
    tokenAddress: string,
    tokenId: string,
    price: string,
    fromVendor: boolean,
  ) => {
    await this.isEnabledAndHasProvider();
    const instance = this.cargo.createCargoTokenInstance(tokenAddress);
    const tx = await this.promisify(instance.sell, tokenId, price, fromVendor, {
      from: this.accounts[0],
    });

    return tx;
  };

  // DEPRECATED
  // THIS METHOD WILL NOT WORK WITH BATCHES AND WILL BE REMOVED
  // Use the getOwnedTokensByContract method for new tokens
  // 🦊
  getOwnedTokenIdsByCargoTokenContractId = async (
    cargoTokenContractId: string,
  ) => {
    await this.isEnabledAndHasProvider();
    const {
      cargo: { instance },
    } = this.contracts;

    let data: Array<Object>;

    try {
      data = await this.promisifyData(
        // @ts-ignore
        instance.getOwnedTokenIdsByCargoTokenContractId.call,
        cargoTokenContractId,
        { from: this.accounts[0] },
      );
    } catch (e) {
      data = [];
    }

    return data.map(BnId => BnId.toString());
  };

  // DEPRECATED
  // This is kept around for legacy tokens. Prefer getContractsWithStake for new token contracts
  // 🦊
  // Function that returns cargo contract ids in which user has a stake in
  getOwnedCargoTokenContractIds = async () => {
    await this.isEnabledAndHasProvider();
    const {
      cargo: { instance },
    } = this.contracts;

    const ownedTokens = await this.promisifyData(
      // @ts-ignore
      instance.getOwnedCargoTokenContractIds,
      { from: this.accounts[0] },
    );

    return ownedTokens;
  };

  // 🦊
  updateBeneficiaryCommission = async (
    beneficiaryId: string,
    commission: string,
  ) => {
    await this.isEnabledAndHasProvider();
    const {
      cargoVendor: { instance },
    } = this.contracts;

    const tx = await this.promisify(
      // @ts-ignore
      instance.updateBeneficiaryCommission,
      beneficiaryId,
      commission,
      { from: this.accounts[0] },
    );

    return tx;
  };

  // 🦊
  addBeneficiary = async (
    vendorId: string,
    beneficiaryAddress: string,
    commission: string,
  ) => {
    await this.isEnabledAndHasProvider();
    const {
      cargoVendor: { instance },
    } = this.contracts;

    // @ts-ignore
    const tx = await this.promisify(
      // @ts-ignore
      instance.addBeneficiary,
      vendorId,
      beneficiaryAddress,
      commission,
      { from: this.accounts[0] },
    );

    return tx;
  };

  // 🦊
  getOwnedBeneficiaries = async () => {
    await this.isEnabledAndHasProvider();
    const {
      cargoVendor: { instance },
    } = this.contracts;

    // @ts-ignore
    const beneficiaries = await this.promisifyData(
      // @ts-ignore
      instance.getOwnedBeneficiaries,
      { from: this.accounts[0] },
    );

    return beneficiaries;
  };

  // 🦊
  getOwnedVendors: () => any = async () => {
    await this.isEnabledAndHasProvider();
    const {
      cargoVendor: { instance },
    } = this.contracts;

    // @ts-ignore
    const vendorIds = await this.promisifyData(instance.getOwnedVendors, {
      from: this.accounts[0],
    });
    if (!vendorIds) {
      return [];
    }
    const vendors = await Promise.all(
      vendorIds.map((id: string) => this.getVendorById(id)),
    );
    return vendors;
  };

  // 🦊
  getOwnedCrates: () => any = async () => {
    await this.isEnabledAndHasProvider();
    const {
      cargo: { instance },
    } = this.contracts;

    // @ts-ignore
    const crateIds = await this.promisifyData(instance.getOwnedCrates, {
      from: this.accounts[0],
    });

    if (!crateIds) {
      return [];
    }

    const crates = await Promise.all(
      crateIds.map((id: string) => this.getCrateById(id)),
    );
    return crates;
  };

  // 🦊
  createCrateWithCallbackContract = async (
    publicVendorCreation: boolean,
    callbackContractAddress: string,
  ) => {
    await this.isEnabledAndHasProvider();
    const {
      cargo: { instance },
    } = this.contracts;

    const tx = await this.promisify(
      // @ts-ignore
      instance.createCrateWithCallbackContract,
      publicVendorCreation,
      callbackContractAddress,
      { from: this.accounts[0] },
    );

    return tx;
  };

  // 🦊
  createCrate = async (publicVendorCreation: boolean) => {
    await this.isEnabledAndHasProvider();
    const {
      cargo: { instance },
    } = this.contracts;

    let tx;

    try {
      tx = await this.promisify(
        // @ts-ignore
        instance.createCrate,
        publicVendorCreation,
        { from: this.accounts[0] },
      );
    } catch (e) {
      throw new Error(e);
    }

    return tx;
  };

  // 🦊
  updateCrateApplicationFee = async (fee: string, crateId: string) => {
    await this.isEnabledAndHasProvider();
    const {
      cargo: { instance },
    } = this.contracts;

    // @ts-ignore
    const tx = await this.promisify(
      // @ts-ignore
      instance.updateCrateApplicationFee,
      fee,
      crateId,
      { from: this.accounts[0] },
    );

    return tx;
  };

  // 🦊
  withdraw = async (amount: string, beneficiaryId: string, to: string) => {
    await this.isEnabledAndHasProvider();
    const {
      cargoFunds: { instance },
    } = this.contracts;

    const tx = await this.promisify(
      // @ts-ignore
      instance.withdraw,
      amount,
      beneficiaryId,
      to,
      { from: this.accounts[0] },
    );

    return tx;
  };

  // 🦊
  resellerWithdraw = async (to: string, amount: string) => {
    await this.isEnabledAndHasProvider();
    const {
      cargoFunds: { instance },
    } = this.contracts;

    // @ts-ignore
    const tx = await this.promisify(instance.resellerWithdraw, to, amount, {
      from: this.accounts[0],
    });

    return tx;
  };

  // 🦊
  // Amount is in Wei
  purchaseResaleToken = async (
    resaleItemId: string,
    amount: string,
  ): Promise<string> => {
    await this.isEnabledAndHasProvider();
    const {
      cargoSell: { instance },
    } = this.contracts;

    const tx = await this.promisify(
      // @ts-ignore
      instance.purchaseResaleToken,
      resaleItemId,
      {
        from: this.accounts[0],
        value: amount,
      },
    );

    return tx as string;
  };
}
