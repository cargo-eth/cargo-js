import { ContractNames } from './cargo';
import packageJson from '../package.json';

const VALID_CONTRACTS: ContractNames[] = [
  'cargoNft',
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

  const setCache = (contract: ContractNames, value: ContractData) => {
    cache[contract] = value;
    sessionStorage.setItem(CARGO_LOCAL_STORAGE_KEY, JSON.stringify(cache));
  };

  const getContract = async (
    contract: ContractNames,
  ): Promise<ContractData> => {
    if (cache[contract]) {
      return cache[contract];
    }

    const response = await fetch(
      `${requestUrl}/v3/get-contract-abi/${contract}`,
    );

    if (response.status === 200) {
      const body = await response.json();
      setCache(contract, body);
      return body;
    } else {
      throw new Error(`Could not fetch contract ${contract}`);
    }
  };

  return async (contract: ContractNames) => {
    if (!VALID_CONTRACTS.includes(contract)) {
      throw new Error(`${contract} is not a valid contract`);
    }
    return getContract(contract);
  };
};
