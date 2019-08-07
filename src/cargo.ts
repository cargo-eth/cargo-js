// @ts-ignore
import Web3 from 'web3';
import { Provider } from 'web3/providers';
import Contract from 'web3/eth/contract';
// @ts-ignore
import BigNumber from 'bignumber.js';
import getAllContracts from './getAllContracts';
import Emitter from './events';
import CargoApi from './api';
import PollTx from './pollTx';
import Utils from './utils';

export type TNetwork = 'local' | 'development' | 'production';

type CargoOptions = {
  network: TNetwork;
  provider?: Object;
};

const validOptionKeys: (keyof CargoOptions)[] = ['network', 'provider'];

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
  network: 'development',
};

const REQUEST_URLS: { [N in TNetwork]: string } = {
  local: 'http://localhost:3333',
  development: 'https://dev-api.cargo.engineering',
  production: 'https://api.cargo.build',
};

export type Contracts = { [Name in ContractNames]: ContractObject };

class Cargo extends Emitter {
  options: CargoOptions;

  requestUrl?: string;

  contracts: Contracts;

  accounts?: Array<string>;

  initialized?: boolean;

  web3?: Web3;

  providerRequired?: boolean;

  api?: CargoApi;

  BigNumber: typeof BigNumber;

  pollTx?: PollTx;

  Web3?: Web3;

  provider: Provider;

  utils?: Utils;

  constructor(options?: CargoOptions) {
    super();
    this.BigNumber = BigNumber;
    this.utils = new Utils();
    this.Web3 = Web3;
    this.provider =
      window['ethereum'] || (window.web3 && window.web3.currentProvider);
    this.providerRequired = !this.provider;

    if (options) {
      if (!(typeof options === 'object' && !Array.isArray(options))) {
        throw new Error('Options are invalid.');
      }

      Object.keys(options).forEach((key: keyof CargoOptions) => {
        if (!validOptionKeys.includes(key)) {
          throw new Error(`${key} is not a valid Cargo option.`);
        }
      });
    }

    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    this.requestUrl = REQUEST_URLS[this.options.network];

    // Verfiy that the network option is valid
    if (!this.requestUrl) {
      throw new Error(`${this.options.network} is not a valid network.`);
    }
  }

  private denominator = new BigNumber(1 * 10 ** 18);

  public getCommission = (percent: number) => this.denominator.times(new BigNumber(percent)).toString();

  private setUpWeb3 = () => {
    if (this.provider) {
      this.providerRequired = false;
      const web3 = new Web3(this.provider);
      this.web3 = web3;
      window.web3 = web3;
      this.initializeContracts();
      return true;
    } else {
      this.emit('provider-required');
      this.providerRequired = true;
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
  public init = async (): Promise<void> => {
    if (this.initialized) return;

    const contracts = await getAllContracts(this.requestUrl);
    // @ts-ignore
    this.contracts = contracts;
    // @ts-ignore
    this.api = new CargoApi(contracts, this.requestUrl, this);
    this.pollTx = new PollTx(this);

    if (this.provider) {
      this.emit('has-provider-but-not-enabled');
    } else {
      this.emit('provider-required');
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

  request = (
    path: string,
    options?: {},
    isJson: boolean = true,
    rawUrl?: boolean,
  ) => fetch(`${!rawUrl ? `${this.requestUrl}${path}` : path}`, {
    cache: 'no-cache',
    ...options,
  })
    .then(async res => {
      if (isJson) {
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
      } else if (res.ok) {
        return {
          err: false,
        };
      }
    })
    .then(j => j);

  enabled: boolean = false;

  public enable = async () => {
    if (!this.initialized) {
      throw new Error('Call cargo.init before calling enable.');
    }
    if (this.enabled) return true;
    if (this.setUpWeb3()) {
      try {
        if (window.ethereum && window.ethereum.enable) {
          await window.ethereum.enable();
          this.accounts = window.web3.eth.accounts;
        } else {
          this.accounts = window.web3.eth.accounts;
        }
        if (!this.accounts) {
          throw new Error('Accounts is undefined. User cancelled');
        }
        this.api.setAccounts(this.accounts);
        this.emit('enabled');
        this.enabled = true;

        if (window.web3.currentProvider.isMetaMask) {
          // @ts-ignore
          window.ethereum.on('accountsChanged', accounts => {
            this.accounts = accounts;
            this.api.setAccounts(accounts);
            this.emit('accounts-changed', accounts);
          });
        }

        return true;
      } catch (e) {
        this.emit('has-provider-but-not-enabled');
        return false;
      }
    } else {
      return false;
    }
  };
}

export default Cargo;
