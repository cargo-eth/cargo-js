import fetch from 'isomorphic-fetch';
import { TContracts, TContractNames } from './cargo';

type TMintParams = {
  hasFiles: boolean;
  signature?: string;
  account?: string;
  vendorId: string;
  tokenAddress: string;
  name?: string;
  description?: string;
  metadata?: string;
  files: FileList;
  previewImage: File;
};

export default class CargoApi {
  requestUrl: string;

  hasMetaMask: boolean;

  contracts: TContracts;

  web3: any;

  accounts: Array<string>;

  constructor(
    contracts: TContracts,
    requestUrl: string,
    hasMetaMask: boolean,
    web3: any,
  ) {
    this.requestUrl = requestUrl;
    this.hasMetaMask = hasMetaMask;
    this.contracts = contracts;
    this.web3 = web3;
  }

  setAccounts(accounts: Array<string>) {
    this.accounts = accounts;
  }

  request(path, options?: {}) {
    return fetch(`${this.requestUrl}${path}`, options)
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
  }

  // Methods that do not require metamask
  getBeneficiaryBalance(beneficiaryId: string) {
    return this.request(`/v1/get-beneficiary-balance/${beneficiaryId}`);
  }

  getBeneficiaryById(beneficiaryId: string) {
    return this.request(`/v1/get-beneficiary-by-id/${beneficiaryId}`);
  }

  getBeneficiaryVendor(beneficiaryId: string) {
    return this.request(`/v1/get-beneficiary-vendor/${beneficiaryId}`);
  }

  getContract(contract: TContractNames) {
    return this.request(`/v1/get-contract/${contract}`);
  }

  getCrateById(crateId: string) {
    return this.request(`/v1/get-crate-by-id/${crateId}`);
  }

  getCrateVendors(crateId: string) {
    return this.request(`/v1/get-crate-vendors/${crateId}`);
  }

  getMintedTokens(tokenAddress: string) {
    return this.request(`/v1/get-minted-tokens/${tokenAddress}`);
  }

  getResellerBalance(resellerAddress: string) {
    return this.request(`/v1/get-reseller-balance/${resellerAddress}`);
  }

  getTokenContractById(tokenContractId: string) {
    return this.request(`/v1/get-token-contract-by-id/${tokenContractId}`);
  }

  getTokenContractByAddress(tokenAddress: string) {
    return this.request(`/v1/get-token-contract-by-address/${tokenAddress}`);
  }

  getVendorBeneficiaries(vendorId: string) {
    return this.request(`/v1/get-vendor-beneficiaries/${vendorId}`);
  }

  getVendorById(vendorId: string) {
    return this.request(`/v1/get-vendor-by-id/${vendorId}`);
  }

  getVendorCrate(vendorId: string) {
    return this.request(`/v1/get-vendor-crate/${vendorId}`);
  }

  getVendorTokenContracts(vendorId: string) {
    return this.request(`/v1/get-vendor-token-contracts/${vendorId}`);
  }

  private requestMintAbi(parameters: TMintParams) {
    const formData = new FormData();
    const { files, previewImage, ...rest } = parameters;
    Object.keys(rest).forEach(key => {
      const value = rest[key];
      formData.append(key, value);
    });
    return this.request('/v1/mint', {
      method: 'POST',
      body: formData,
    });
  }

  private getSignature(): Promise<string> {
    return new Promise((resolve, reject) => {
      const msgParams = [
        {
          type: 'string',
          name: 'Message',
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
        (err, result) => {
          if (err) return reject(new Error(err.message));
          if (result.error) {
            return reject(new Error(result.error.message));
          }
          resolve(result.result);
        },
      );
    });
  }

  private requireMetaMask = () => {
    if (!this.hasMetaMask) {
      throw new Error('Metamask required');
    }
  };

  private sendTx = options => new Promise((resolve, reject) => {
    this.web3.eth.sendTransaction(options, (err, tx) => {
      console.log(err);
      if (!err) {
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

  private promisify = (fn, ...args) => new Promise((resolve, reject) => {
    fn(...args, (err, tx) => {
      console.log(err);
      if (!err) {
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

  private promisifyData = (fn, ...args) => new Promise((resolve, reject) => {
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
  async mint(parameters: TMintParams) {
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
    } = parameters;
    const signature = await this.getSignature();
    const res = await this.requestMintAbi({
      account: this.accounts[0],
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
  }

  // 🦊
  async createTokenContract(
    vendorId: string,
    tokenContractName: string,
    symbol: string,
    limitedSupply: boolean,
    maxSupply: string,
  ) {
    const {
      cargoAsset: { instance },
    } = this.contracts;

    // @ts-ignore
    const tx = await this.promisify(instance.createTokenContract, vendorId, tokenContractName, symbol, limitedSupply, maxSupply, {
      from: this.accounts[0],
    });

    return tx;
  }

  // 🦊
  async addVendor(crateId: string, vendorAddress: string) {
    const { cargo: { instance } } = this.contracts;

    // @ts-ignore
    const tx = await this.promisify(instance.addVendor, crateId, vendorAddress, {
      from: this.accounts[0],
    });
  }

  // 🦊
  async publicAddVendor(crateId: string) {
    const { cargo: { instance } } = this.contracts;

    // @ts-ignore
    const tx = await this.promisify(instance.publicAddVendor, crateId, { from: this.accounts[0] });

    return tx;
  }

  // 🦊
  async getOwnedTokenIdsByCargoTokenContractId(cargoTokenContractId: string) {
    const { cargo: { instance } } = this.contracts;

    // @ts-ignore
    const data = await this.promisifyData(instance.getOwnedTokenIdsByCargoTokenContractId.call, cargoTokenContractId, { from: this.accounts[0] });

    return data;
  }

  // 🦊
  async getOwnedCargoTokenContractIds() {
    const { cargo: { instance } } = this.contracts;

    // @ts-ignore
    const ownedTokens = await this.promisifyData(instance.getOwnedCargoTokenContractIds.call, { from: this.accounts[0] });

    return ownedTokens;
  }

  // 🦊
  async updateBeneficiaryCommission(beneficiaryId: string, commission: string) {
    const { cargo: { instance } } = this.contracts;

    // @ts-ignore
    const tx = this.promisify(instance.updateBeneficiaryCommission, beneficiaryId, commission, { from: this.accounts[0] });

    return tx;
  }


}
