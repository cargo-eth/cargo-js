/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import Web3 from 'web3';
import packageJson from '../package.json';

import BigNumber from 'bignumber.js';
import { Emitter } from './events';
import CargoApi from './api';
import PollTx from './pollTx';
import Utils from './utils';
import getContractAbi, { ContractData } from './getContractAbi';
import { Chain } from './types';

export type TNetwork = 'local' | 'development' | 'production';

type CargoOptions = {
  network: TNetwork;
  provider?: Record<string, unknown>;
};

const validOptionKeys: (keyof CargoOptions)[] = ['network', 'provider'];

declare global {
  interface Window {
    ethereum?: Record<string, unknown> & { enable: () => Array<string> };
    web3?: Web3;
    isNaN: (any) => boolean;
  }
}

export type ContractNames =
  | 'orderExecutor1155V1'
  | 'cargoNft'
  | 'orderExecutorV1'
  | 'orderExecutorV2'
  | 'magicMintUtil'
  | 'erc1155'
  | 'nftCreator'
  | 'cargoData'
  | 'cargoAsset'
  | 'cargoSell'
  | 'cargoMintingCredits'
  | 'super721'
  | 'cargoGemsStaking'
  | 'erc20'
  | 'cargoGems'
  | 'cargoVendor'
  | 'nftFarm';

type Provider = any;
type Contract = any;

type ContractObject = {
  name: ContractNames;
  abi: Array<Record<string, unknown>>;
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
  development: 'https://ecs-dev.cargo.engineering',
  production: 'https://api3.cargo.build',
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

  estimateGas?: boolean;

  BigNumber: typeof BigNumber;

  pollTx?: PollTx;

  Web3?: typeof Web3;

  provider: Provider;

  utils?: Utils;

  getContract?: (
    contract: ContractNames,
    chain: Chain,
  ) => Promise<ContractData>;

  getContractInstance?: (
    contract: ContractNames,
    network?: Chain,
    setAddress?: string,
  ) => Promise<Contract>;

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
      (options && options.provider) ||
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

  private denominator = new BigNumber(10 ** 18);

  public getCommission = (percent: number) =>
    this.denominator.times(percent).toFixed();

  public fromCommission = (val: string) =>
    new BigNumber(val).div(this.denominator).toFixed();

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
    options?: Record<string, unknown>,
    isJson = true,
    rawUrl?: boolean,
  ): TResp<SuccessData, ErrorData> =>
    fetch(`${!rawUrl ? `${this.requestUrl}${path}` : path}`, {
      cache: 'no-cache',
      ...options,
    }).then(async (res) => {
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

  enabled = false;

  contractInstanceCache: {
    [requestUrl: string]: { [contract in ContractNames]?: Contract };
  } = {};

  public enable = async () => {
    if (this.enabled) return true;
    if (this.setUpWeb3()) {
      this.getContractInstance = async (
        contract: ContractNames,
        network: Chain = 'eth',
        setAddress?: string,
      ) => {
        const { abi, address } = await this.getContract(contract, network);
        const contractInstance = new this.web3.eth.Contract(
          // @ts-ignore
          abi,
          address || setAddress,
        );
        return contractInstance;
      };
      try {
        if (this.provider && this.provider.isMetaMask) {
          // @ts-ignore
          window.ethereum.on('accountsChanged', (accounts) => {
            this.accounts = accounts;
            this.api.setAccounts(accounts);
            this.emit('accounts-changed', accounts);
          });
        }

        if (this.provider && this.provider.enable) {
          const accounts = await this.provider.enable();
          this.accounts = accounts || window.web3.eth.accounts;
        } else {
          this.accounts = (window.web3.eth.accounts as unknown) as string[];
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
