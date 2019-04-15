import * as fetch from 'isomorphic-fetch';
import Cargo, { TContracts, TContractNames } from './cargo';

type TMintParams = {
  hasFiles: boolean;
  vendorId: string;
  tokenAddress: string;
  name?: string;
  description?: string;
  metadata?: string;
  files: File[];
  previewImage: File;
  to?: string;
};

interface TCargoApiInterface {
  promisifyData(fn: Function, ...args: Array<any>): Promise<any>;
}

export default class CargoApi {
  requestUrl: string;

  hasMetaMask: boolean;

  contracts: TContracts;

  web3: any;

  accounts: Array<string>;

  cargo: Cargo;

  constructor(
    contracts: TContracts,
    requestUrl: string,
    hasMetaMask: boolean,
    web3: any,
    cargo: Cargo,
  ) {
    this.requestUrl = requestUrl;
    this.hasMetaMask = hasMetaMask;
    this.contracts = contracts;
    this.web3 = web3;
    this.cargo = cargo;
  }

  setAccounts = (accounts: Array<string>) => {
    this.accounts = accounts;
  };

  request = (path: string, options?: {}) => fetch(`${this.requestUrl}${path}`, options)
    .then(async res => {
      const json = await res.json();
      if (res.ok) {
        return {
          err: false,
          data: json,
        };
      }
      return {
        err: true,
        data: json,
      };
    })
    .then(j => j);

  // Methods that do not require metamask
  getBeneficiaryBalance = (beneficiaryId: string) => this.request(`/v1/get-beneficiary-balance/${beneficiaryId}`);

  getBeneficiaryById = (beneficiaryId: string) => this.request(`/v1/get-beneficiary-by-id/${beneficiaryId}`);

  getBeneficiaryVendor = (beneficiaryId: string) => this.request(`/v1/get-beneficiary-vendor/${beneficiaryId}`);

  getContract = (contract: TContractNames) => this.request(`/v1/get-contract/${contract}`);

  getCrateById = (crateId: string) => this.request(`/v1/get-crate-by-id/${crateId}`);

  getCrateVendors = (crateId: string) => this.request(`/v1/get-crate-vendors/${crateId}`);

  getMintedTokens = (tokenAddress: string) => this.request(`/v1/get-minted-tokens/${tokenAddress}`);

  getResellerBalance = (resellerAddress: string) => this.request(`/v1/get-reseller-balance/${resellerAddress}`);

  getTokenContractById = (tokenContractId: string) => this.request(`/v1/get-token-contract-by-id/${tokenContractId}`);

  getTokenContractByAddress = (tokenAddress: string) => this.request(`/v1/get-token-contract-by-address/${tokenAddress}`);

  getVendorBeneficiaries = (vendorId: string) => this.request(`/v1/get-vendor-beneficiaries/${vendorId}`);

  getVendorById = (vendorId: string) => this.request(`/v1/get-vendor-by-id/${vendorId}`);

  getVendorCrate = (vendorId: string) => this.request(`/v1/get-vendor-crate/${vendorId}`);

  getVendorTokenContracts = (vendorId: string) => this.request(`/v1/get-vendor-token-contracts/${vendorId}`);

  getOwnedResaleItems = (address: string) => this.request(`/v1/get-owned-resale-items/${address}`);

  getContractResaleItems = (contracts: Array<string>) => this.request(
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

  private getSignature = (): Promise<string> => new Promise((resolve, reject) => {
    const msgParams = [
      {
        type: 'string',
        name:
            'I certify that I am the rightful owner of the following address',
        value: this.accounts[0],
      },
    ];

    const from = this.accounts[0];

    const params = [msgParams, from];
    const method = 'eth_signTypedData';

    this.web3.currentProvider.sendAsync(
      {
        method,
        params,
        from,
      },
      (err: Error, result: any) => {
        if (err) return reject(new Error(err.message));
        if (result.error) {
          return reject(new Error(result.error.message));
        }
        resolve(result.result);
      },
    );
  });

  private requireMetaMask = () => {
    if (!this.hasMetaMask) {
      throw new Error('Metamask required');
    }
  };

  private sendTx = (options: Object) => new Promise((resolve, reject) => {
    this.web3.eth.sendTransaction(options, (err: Error, tx: string) => {
      console.log(err);
      if (!err) {
        this.web3.eth.getTransactionReceipt(tx, (err: Error, data: any) => {
          if (data.status === '0x00') {
            reject('reverted');
          } else {
            resolve(tx);
          }
        });
      }
    });
  });

  // @ts-ignore
  private promisify = (fn, ...args) => new Promise((resolve, reject) => {
    try {
      this.requireMetaMask();
    } catch (e) {
      return reject(e);
    }

    // @ts-ignore
    fn(...args, (err, tx) => {
      console.log(err);
      if (!err) {
        // @ts-ignore
        this.web3.eth.getTransactionReceipt(tx, (err, data) => {
          if (data.status === '0x00') {
            reject('reverted');
          } else {
            resolve(tx);
          }
        });
      }
    });
  });

  private promisifyData: (fn: Function, ...args: Array<any>) => Promise<any> = (
    fn,
    ...args
  ) => new Promise((resolve, reject) => {
    try {
      this.requireMetaMask();
    } catch (e) {
      return reject(e);
    }

    // @ts-ignore
    fn(...args, (err, data) => {
      if (!err) {
        resolve(data);
      } else {
        reject(err);
      }
    });
  });

  // Methods that require metamask

  // 🦊
  mint = async (parameters: TMintParams) => {
    this.requireMetaMask();
    const {
      tokenAddress,
      vendorId,
      files,
      hasFiles,
      previewImage,
      name,
      description,
      metadata,
      to,
    } = parameters;
    const signature = await this.getSignature();
    const res = await this.requestMintAbi({
      account: to || this.accounts[0],
      tokenAddress,
      hasFiles,
      files,
      previewImage,
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
  createTokenContract = async (
    vendorId: string,
    tokenContractName: string,
    symbol: string,
    limitedSupply: boolean,
    maxSupply: string,
  ) => {
    const {
      cargoAsset: { instance },
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
  };

  // 🦊
  publicAddVendor = async (crateId: string) => {
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
    const instance = this.cargo.createCargoTokenInstance(tokenAddress);
    const tx = await this.promisify(instance.sell, tokenId, price, fromVendor, {
      from: this.accounts[0],
    });

    return tx;
  };

  // 🦊
  getOwnedTokenIdsByCargoTokenContractId = async (
    cargoTokenContractId: string,
  ) => {
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

    return data;
  };

  // 🦊
  getOwnedCargoTokenContractIds = async () => {
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
  getOwnedVendors = async () => {
    const {
      cargoVendor: { instance },
    } = this.contracts;

    // @ts-ignore
    const vendorIds = await this.promisifyData(instance.getOwnedVendors, {
      from: this.accounts[0],
    });
    const vendors = await Promise.all(
      vendorIds.map((id: string) => this.getVendorById(id)),
    );
    return vendors;
  };

  // 🦊
  getOwnedCrates = async () => {
    const {
      cargo: { instance },
    } = this.contracts;

    // @ts-ignore
    const crateIds = await this.promisifyData(instance.getOwnedCrates, {
      from: this.accounts[0],
    });
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
    const {
      cargo: { instance },
    } = this.contracts;

    const tx = await this.promisify(
      // @ts-ignore
      instance.createCrate,
      publicVendorCreation,
      { from: this.accounts[0] },
    );

    return tx;
  };

  // 🦊
  updateCrateApplicationFee = async (fee: string, crateId: string) => {
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
    const {
      cargoFunds: { instance },
    } = this.contracts;

    // @ts-ignore
    const tx = await this.promisify(instance.resellerWithdraw, to, amount, {
      from: this.accounts[0],
    });

    return tx;
  };
}
