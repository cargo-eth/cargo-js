// @flow
import Web3 from 'web3';
import getAllContracts from './getAllContracts';
import { provider } from 'web3-providers/types';
import { Contract } from 'web3-eth-contract/types';
import Emitter from './events';
import CargoApi from './api';
type TNetwork = 'local' | 'development' | 'production';

type TCargoOptions = {
  network: TNetwork,
  provider?: Object,
};

declare global {
  interface Window {
    ethereum?: provider & { enable: () => Array<string> };
    web3?: Web3;
    ___CARGO_ACCOUNTS___?: Array<string>,
  }
}

export type TContractNames = 'cargo' | 'cargoSell' | 'cargoData' | 'cargoFunds' | 'cargoToken';

type TContractObject = {
  name: TContractNames,
  abi: Array<Object>,
  address?: string,
  instance?: Contract,
}


const DEFAULT_OPTIONS: TCargoOptions = {
  network: 'local',
};

const REQUEST_URLS: { [N in TNetwork]: string } = {
  local: 'http://localhost:3000',
  development: '',
  production: '',
};

function initializeContracts() {
  Object.keys(this.contracts).forEach(name => {
    const data = this.contracts[name];
    if (name !== 'cargoToken') {
      this.contracts[name].instance = new this.web3.eth.Contract(
        data.abi,
        data.address,
      );
    }
  });
}

export type TContracts = {
  [Name in TContractNames]: TContractObject;
};


class Cargo extends Emitter {
  options: TCargoOptions;
  requestUrl?: string;
  contracts: TContracts;
  accounts?: Array<string>;
  initialized?: boolean;
  web3?: Web3;
  metaMaskRequired?: true;
  api?: CargoApi;

  constructor() {
    super();
  }

  private setUpWeb3() {
    if (window.ethereum) {
      const web3 = new Web3(window.ethereum);
      this.web3 = web3;
      window.web3 = web3;
      this.initializeContracts();
    } else {
      this.emit('metamask-required');
      this.metaMaskRequired = true;
    }
  }

  private initializeContracts() {
    Object.keys(this.contracts).forEach(name => {
      const data = this.contracts[name];
      if (name !== 'cargoToken') {
        this.contracts[name].instance = new this.web3.eth.Contract(
          data.abi,
          data.address,
        );
      }
    });
  }

  public init = async (options) => {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    this.requestUrl = REQUEST_URLS[this.options.network];
    this.contracts = await getAllContracts(this.requestUrl);
    this.setUpWeb3();
    this.api = new CargoApi(this.contracts, this.requestUrl, !this.metaMaskRequired);
    this.emit('initialized');
    this.initialized = true;
  };

  public enable = async () => {
    if (!this.initialized) {
      throw new Error('Call init() first');
    }

    if (this.web3) {
      window.___CARGO_ACCOUNTS___ = await window.ethereum.enable();
    }
  };
}

export default Cargo;
