export * from './ResaleItemWithMetadata';
export * from './TokenMetadata';
export * from './ResaleItemGroups';

export type TokenMetadata = {
  name: string;
  description: string;
  image: string
  metadata:  { [key: string]: any };
  edition?: string;
}

export type Token = {
  tokenURI: string;
  owner: string;
  metadata: TokenMetadata;
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

export type ResaleItem = {
  sellerAddress: string;
  tokenAddress: string;
  tokenId: string;
  resaleItemId: string;
  price: string;
  fromVendor: boolean;
  metadata: TokenMetadata;
}

export type ContractResaleItemsResponse = {
  currentPage: string;
  totalPages: string;
  total: string;
  resaleItems: ResaleItem[]
}
