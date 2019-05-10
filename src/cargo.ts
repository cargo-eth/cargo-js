// @ts-ignore
import Web3 from 'web3';
import { Provider } from 'web3/providers';
import Contract from 'web3/eth/contract';
// @ts-ignore
import BigNumber from 'bignumber.js';
import getAllContracts from './getAllContracts';
import Emitter from './events';
import CargoApi from './api';

type TNetwork = 'local' | 'development' | 'production';

type CargoOptions = {
  network: TNetwork;
  provider?: Object;
};

declare global {
  interface Window {
    ethereum?: Provider & { enable: () => Array<string> };
    web3?: Web3;
  }
}

export type ContractNames =
  | 'cargo'
  | 'cargoSell'
  | 'cargoData'
  | 'cargoFunds'
  | 'cargoToken'
  | 'cargoVendor'
  | 'cargoAsset';

type ContractObject = {
  name: ContractNames;
  abi: Array<Object>;
  address?: string;
  instance?: Contract;
};

const DEFAULT_OPTIONS: CargoOptions = {
  network: 'local',
};

const REQUEST_URLS: { [N in TNetwork]: string } = {
  local: 'http://localhost:3333',
  development: '',
  production: '',
};

export type TContracts = { [Name in ContractNames]: ContractObject };

class Cargo extends Emitter {
  options: CargoOptions;

  requestUrl?: string;

  contracts: TContracts;

  accounts?: Array<string>;

  initialized?: boolean;

  web3?: Web3;

  metaMaskRequired?: true;

  api?: CargoApi;

  BigNumber: BigNumber;

  Web3?: Web3;

  constructor() {
    super();
    this.BigNumber = BigNumber;
    this.Web3 = Web3;
  }

  private denominator = new BigNumber(1 * 10 ** 18);

  public getCommission = (percent: number) => this.denominator.times(new BigNumber(percent)).toString();

  provider: Provider =
    window['ethereum'] || (window.web3 && window.web3.currentProvider);

  private setUpWeb3 = () => {
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
  };

  private initializeContracts = () => {
    Object.keys(this.contracts).forEach(name => {
      // @ts-ignore
      const data = this.contracts[name];
      if (name !== 'cargoToken') {
        // @ts-ignore
        this.contracts[name].instance = this.web3.eth
          .contract(data.abi)
          .at(data.address);
      }
    });
  };

  // @ts-ignore
  public init = async (options?: CargoOptions): Promise<void> => {
    if (this.initialized) return;

    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    this.requestUrl = REQUEST_URLS[this.options.network];
    // @ts-ignore
    this.contracts = await getAllContracts(this.requestUrl);
    this.api = new CargoApi(
      this.contracts,
      this.requestUrl,
      !this.metaMaskRequired,
      this,
    );

    if (this.provider) {
      this.emit('has-metamask-but-not-enabled');
    }

    this.initialized = true;
  };

  public createCargoTokenInstance = (address: string) => {
    if (!this.enabled) {
      throw new Error('Enable Cargo before calling this method');
    } else {
      return this.web3.eth.contract(this.contracts.cargoToken.abi).at(address);
    }
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

  enabled: boolean = false;

  public enable = async () => {
    if (!this.initialized) {
      throw new Error('Call cargo.init before calling enable.');
    }
    if (this.enabled) return;
    if (this.setUpWeb3()) {
      try {
        this.accounts = await window.ethereum.enable();
        this.api.setAccounts(this.accounts);
        this.emit('enabled');
        this.enabled = true;
        return true;
      } catch (e) {
        this.emit('has-metamask-but-not-enabled');
        return false;
      }
    } else {
      return false;
    }
  };
}

export default Cargo;
