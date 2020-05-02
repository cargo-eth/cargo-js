// @ts-ignore
import Web3 from 'web3';
// @ts-ignore
import { Provider } from 'web3/providers';
import packageJson from '../package.json';
// @ts-ignore
import Contract from 'web3/eth/contract';
// @ts-ignore
import BigNumber from 'bignumber.js';
import { Emitter } from './events';
import CargoApi from './api';
import PollTx from './pollTx';
import Utils from './utils';
import getContractAbi, { ContractData } from './getContractAbi';

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
    isNaN: Function;
  }
}

export type ContractNames =
  | 'cargoNft'
  | 'nftCreator'
  | 'cargoData'
  | 'cargoAsset'
  | 'cargoSell'
  | 'cargoMintingCredits'
  | 'cargoVendor';

type ContractObject = {
  name: ContractNames;
  abi: Array<Object>;
  address?: string;
  instance?: Contract;
};

export type TSuccessResponse<Data> = {
  err: false;
  status: number;
  data?: Data;
};
export type TErrorResponse<Data> = {
  status: number;
  err: true;
  errorData?: Data;
};

export type TResolvedResponse<Success, Error extends any> =
  | TSuccessResponse<Success>
  | TErrorResponse<Error>;

export type TResp<Success, Error extends any> = Promise<
  TResolvedResponse<Success, Error>
>;

const DEFAULT_OPTIONS: CargoOptions = {
  network: 'development',
};

const REQUEST_URLS: { [N in TNetwork]: string } = {
  local: 'http://localhost:3333',
  development: 'https://development.cargo.engineering',
  production: 'https://api2.cargo.build',
};

export type ResponseType<D> =
  | {
      err: true;
      data: void;
    }
  | {
      err: false;
      data: D;
    };

export type Contracts = { [Name in ContractNames]: ContractObject };

class Cargo extends Emitter {
  options: CargoOptions;

  requestUrl?: string;

  contracts: Contracts;

  accounts?: Array<string>;

  initialized?: boolean;

  web3?: Web3;

  hasProvider?: boolean;

  api?: CargoApi;

  BigNumber: typeof BigNumber;

  pollTx?: PollTx;

  Web3?: typeof Web3;

  provider: Provider;

  utils?: Utils;

  getContract?: (contract: ContractNames) => Promise<ContractData>;

  getContractInstance?: (
    contract: ContractNames,
    setAddress?: string,
  ) => Promise<typeof Contract>;

  constructor(options?: CargoOptions) {
    super();
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    this.BigNumber = BigNumber;
    this.utils = new Utils();
    this.Web3 = Web3;
    this.provider =
      options.provider ||
      window['ethereum'] ||
      (window.web3 && window.web3.currentProvider);
    this.hasProvider = !!this.provider;

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

    this.requestUrl = REQUEST_URLS[this.options.network];

    this.getContract = getContractAbi(this.requestUrl);

    // Verfiy that the network option is valid
    if (!this.requestUrl) {
      throw new Error(`${this.options.network} is not a valid network.`);
    }

    this.api = new CargoApi(this.requestUrl, this);
    this.pollTx = new PollTx(this);

    this.initialized = true;
  }

  setProvider(provider: Provider) {
    if (!provider) throw new Error('Provider must be provided');
    this.provider = provider;
    this.hasProvider = true;
    this.setUpWeb3();
  }

  private denominator = new BigNumber(1 * 10 ** 18);

  public getCommission = (percent: number) =>
    this.denominator.times(new BigNumber(percent)).toString();

  private setUpWeb3 = () => {
    if (this.provider) {
      const web3 = new Web3(this.provider);
      this.web3 = web3;
      window.web3 = web3;
      return true;
    } else {
      this.emit('provider-required');
      return false;
    }
  };

  public version = packageJson.version;

  request = <SuccessData, ErrorData>(
    path: string,
    options?: {},
    isJson: boolean = true,
    rawUrl?: boolean,
  ): TResp<SuccessData, ErrorData> =>
    fetch(`${!rawUrl ? `${this.requestUrl}${path}` : path}`, {
      cache: 'no-cache',
      ...options,
    }).then(async res => {
      if (isJson) {
        const json = await res.json();
        if (res.ok) {
          return {
            err: false,
            status: res.status,
            data: json,
          } as TSuccessResponse<SuccessData>;
        }
        return {
          status: res.status,
          err: true,
          errorData: json as ErrorData,
        } as TErrorResponse<ErrorData>;
      } else if (res.ok) {
        return {
          err: false,
          status: res.status,
        } as TSuccessResponse<undefined>;
      }
    });

  enabled: boolean = false;

  contractInstanceCache: {
    [requestUrl: string]: { [contract in ContractNames]?: typeof Contract };
  } = {};

  public enable = async () => {
    if (this.enabled) return true;
    if (this.setUpWeb3()) {
      this.getContractInstance = async (
        contract: ContractNames,
        setAddress?: string,
      ) => {
        if (this.contractInstanceCache[this.requestUrl][contract]) {
          return this.contractInstanceCache[this.requestUrl][contract];
        }
        const { abi, address } = await this.getContract(contract);
        const contractInstance = new this.web3.eth.Contract(
          // @ts-ignore
          abi,
          address || setAddress,
        );
        if (contract !== 'cargoNft') {
          this.contractInstanceCache[this.requestUrl][
            contract
          ] = contractInstance;
        }
        return contractInstance;
      };
      try {
        if (this.provider && this.provider.isMetaMask) {
          // @ts-ignore
          window.ethereum.on('accountsChanged', accounts => {
            this.accounts = accounts;
            this.api.setAccounts(accounts);
            this.emit('accounts-changed', accounts);
          });
        }

        if (this.provider && this.provider.enable) {
          const accounts = await this.provider.enable();
          this.accounts = accounts || window.web3.eth.accounts;
        } else {
          this.accounts = window.web3.eth.accounts;
        }
        if (!this.accounts) {
          throw new Error('Accounts is undefined. User cancelled');
        }
        this.api.setAccounts(this.accounts);
        this.emit('enabled');
        this.enabled = true;

        return true;
      } catch (e) {
        this.emit('enable-required');
        return false;
      }
    } else {
      return false;
    }
  };
}

export { Cargo };
