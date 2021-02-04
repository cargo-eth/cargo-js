import { ContractNames } from './cargo';
import packageJson from '../package.json';
import { Chain } from './types';

const VALID_CONTRACTS: ContractNames[] = [
  'orderExecutor1155V1',
  'cargoNft',
  'orderExecutorV1',
  'orderExecutor1155V1',
  'nftCreator',
  'erc1155',
  'cargoData',
  'cargoAsset',
  'cargoVendor',
  'cargoSell',
  'cargoMintingCredits',
  'super721',
  'magicMintUtil',
  'cargoGemsStaking',
  'erc20',
  'cargoGems',
  'nftFarm',
];

const CARGO_LOCAL_STORAGE_KEY = `__CARGO_LS_KEY__${packageJson.version}`;

export type ContractData = {
  abi: string;
  address?: string;
};

type Cache = {
  [contract in ContractNames]?: {
    abi: string;
    address?: string;
  }
};

export default (requestUrl: string) => {
  let cache: Cache;
  try {
    cache = JSON.parse(sessionStorage.getItem(CARGO_LOCAL_STORAGE_KEY)) || {};
  } catch (e) {
    cache = {};
  }

  const setCache = (
    contract: ContractNames,
    network: Chain,
    value: ContractData,
  ) => {
    cache[network] = cache[network] || {};
    cache[network][contract] = value;
    sessionStorage.setItem(CARGO_LOCAL_STORAGE_KEY, JSON.stringify(cache));
  };

  const getContract = async (
    contract: ContractNames,
    network: Chain,
  ): Promise<ContractData> => {
    const networkCache = cache[network] || {};
    if (networkCache[contract]) {
      return networkCache[contract];
    }

    const response = await fetch(
      `${requestUrl}/v5/contract-abi/${network}/${contract}`,
    );

    if (response.status === 200) {
      const body = await response.json();
      setCache(contract, network, body);
      return body;
    } else {
      throw new Error(`Could not fetch contract ${contract}`);
    }
  };

  return async (contract: ContractNames, network: Chain) => {
    if (!VALID_CONTRACTS.includes(contract)) {
      throw new Error(`${contract} is not a valid contract`);
    }
    return getContract(contract, network);
  };
};
