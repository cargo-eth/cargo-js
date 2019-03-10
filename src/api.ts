import { Contract } from "web3-eth-contract/types";
import fetch from 'isomorphic-fetch';
import { TContracts, TContractNames } from './cargo';
import { request } from "http";
import Web3 from "web3/types";

type TMintParams = {
  hasFiles: boolean,
  signature?: string,
  account?: string,
  vendorId: string,
  tokenAddress: string,
  name?: string,
  description?: string,
  metadata?: string,
  files: FileList,
  previewImage: File,
}

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
    accounts: Array<string>
  ) {
    this.requestUrl = requestUrl;
    this.hasMetaMask = hasMetaMask
    this.contracts = contracts;
    this.web3 = web3;
    this.accounts = accounts;
  }

  request(path) {
    return fetch(`${this.requestUrl}${path}`).then(async (res) => {
      const json = await res.json();
      if (res.ok) {
        return {
          err: false,
          data: json,
        }
      }
      return {
        err: true,
        data: json,
      }
    }).then(j => j);
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

  getResellerBalance(tokenAddress: string) {
    return this.request(`/v1/get-reseller-balance/${tokenAddress}`);
  }

  getTokenContractById(tokenContractId: string) {
    return this.request(`/v1/get-token-contract-by-id/${tokenContractId}`);
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

  private _mint(parameters: TMintParams) {

  }

  // Methods that require metamask
  mint(parameters: TMintParams) {
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
        if (err) throw new Error(err.message);
        if (result.error) {
          throw new Error(result.error.message)
        }
        this._mint({
          signature: result.result,
        });
        console.log(JSON.stringify(result.result));
      }
    );
  }
}
