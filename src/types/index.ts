export * from './ResaleItemWithMetadata';
export * from './TokenMetadata';
export * from './ResaleItemGroups';

export type Token = {
  tokenURI: string;
  owner: string;
  metadata: { [key: string]: any };
  supportsBatchMint: boolean;
  tokenId: string;
  imprint?: string;
};

export type ContractGroupBase = {
  contractId: string;
  currentPage: string;
  tokens: Token[];
  vendorId: string;
  vendorAddress: string;
  totalPages: string;
  totalSupply: string;
};
