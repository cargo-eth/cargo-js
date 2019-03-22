// @ts-ignore
import Web3 from 'web3';
import getAllContracts from './getAllContracts';
import Emitter from './events';
import CargoApi from './api';
import { Provider } from 'web3/providers';
import Contract from 'web3/eth/contract';
// @ts-ignore
import BigNumber from 'bignumber.js';

type TNetwork = 'local' | 'development' | 'production';

type TCargoOptions = {
  network: TNetwork,
  provider?: Object,
};

declare global {
  interface Window {
    ethereum?: Provider & { enable: () => Array<string> };
    web3?: Web3;
  }
}

export type TContractNames = 'cargo' | 'cargoSell' | 'cargoData' | 'cargoFunds' | 'cargoToken' | 'cargoAsset';

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
  provider: Provider;

  constructor() {
    super();
  }

  private denominator = new BigNumber(1 * 10 ** 18);

  public getCommission = (percent: number) => this.denominator.times(new BigNumber(percent)).toString()

  private setUpWeb3 = () => {
    this.provider = window['ethereum'] || (window.web3 && window.web3.currentProvider);
    if (this.provider) {
      const web3 = new Web3(this.provider);
      this.web3 = web3;
      window.web3 = web3;
      this.initializeContracts();
      return true;
    } else {
      this.emit('metamask-required');
      this.metaMaskRequired = true;
      return false;
    }
  }

  private initializeContracts = () => {
    Object.keys(this.contracts).forEach(name => {
      // @ts-ignore
      const data = this.contracts[name];
      if (name !== 'cargoToken') {
        // @ts-ignore
        this.contracts[name].instance = this.web3.eth.contract(
          data.abi,
        ).at(data.address);
      }
    });
  }

  // @ts-ignore
  public init = async (options): Promise<'success' | 'metamask-required'> => {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    this.requestUrl = REQUEST_URLS[this.options.network];
    // @ts-ignore
    this.contracts = await getAllContracts(this.requestUrl);
    if (this.setUpWeb3()) {
      this.api = new CargoApi(this.contracts, this.requestUrl, !this.metaMaskRequired, this.web3);
      this.emit('initialized');
      this.initialized = true;
      return 'success';
    } else {
      return 'metamask-required';
    }

  };

  public enable = async () => {
    if (!this.initialized) {
      this.emit('enable-error', 'Call cargo.init() first.');
      throw new Error('Call init() first');
    }

    if (this.web3) {
      this.accounts = await window.ethereum.enable();
      this.api.setAccounts(this.accounts);
      this.emit('enabled');
    }
  };
}

export default Cargo;
