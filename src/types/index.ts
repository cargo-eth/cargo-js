export * from './ResaleItemWithMetadata';
export * from './TokenMetadata';
export * from './ResaleItemGroups';

export type TokenMetadata = {
  name: string;
  description: string;
  image: string;
  metadata: { [key: string]: any };
  edition?: string;
};

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
};

export type ContractResaleItemsResponse = {
  currentPage: string;
  totalPages: string;
  total: string;
  resaleItems: ResaleItem[];
};

export type VendorBeneficiaryV3 = {
  address: string;
  commission: string;
  vendorAddress: string;
  crateId: string;
  createdAt: string;
};

export type CrateVendorV3 = {
  address: string;
  _id: string;
};

export type UserCrateV3 = {
  name: string;
  id: string;
};

export type GetOrderParams = {
  limit?: string;
  page?: string;
  vendorId?: string;
  contractAddress?: string;
  sellerAddress?: string;
  buyerAddress?: string;
  tokenId?: string;
  crateId?: string;
};

export type ContractV3 = {
  address: string;
  name: string;
  symbol: string;
  supportsMetadata: boolean;
  tags?: string[];
  owned?: boolean;
  totalOwned?: number;
  createdAt: string;
};

export type GetUserTokensByContractParams = {
  page?: string;
  limit?: string;
  contractId: string;
};

export type PaginationResponseWithResults<R> = {
  page: string;
  totalPages: string;
  limit: string;
  results: R;
};

export type ContractMetadata = {
  address: string;
  name: string;
  symbol: string;
  supportsMetadata: boolean;
  tags: string[];
  createdAt: string;
  isOwned?: boolean;
  owner?: string;
  totalSupply: string;
  _id: string;
};

export type ShowcaseId = string;

export type ResaleItemV3 = {
  seller: string;
  contract: string;
  tokenId: string;
  price: string;
  signatureGenerated: boolean;
  groupId: string;
  crate?: string;
  createdAt: string;
  metadata?: { [key: string]: any };
};

export type TokenDetail = {
  owner?: string;
  ownerAddress: string;
  resaleItem?: ResaleItemV3;
  tokenId: string;
  metadata?: { [key: string]: any };
  tokenURI: string;
  contractName: string;
  contractSymbol: string;
  contractAddress: string;
};

export type GetUserShowcaseArgs = {
  page?: string;
  limit?: string;
};

export type GetShowcaseByIdResponse = {
  name: string;
  createdAt: string;
  public: boolean;
  resellingEnabled: boolean;
  slug: string;
  slugId: string;
  isOwner?: boolean;
  isVendor?: boolean;
  owner: { displayUsername: string; address: string };
};

export type GetTokensByContractResponse = {
  name: string;
  symbol;
  totalSupply: string;
} & PaginationResponseWithResults<
  {
    tokenId: string;
    tokenURI;
    metadata: { [key: string]: any };
  }[]
>;

export type CreateConsecutiveSaleParams = {
  crateId: string;
  contractAddress: string;
  pricePerItem: string;
  fromTokenId: string;
  toTokenId: string;
};

export type ConsecutivePurchaseParams = {
  amount: string;
  saleId: string;
  sender: string;
};

// Consecutive Purchase Return Types
interface CPRT {
  contractAddress: string;
  toTokenId: string;
  commission: string;
  amountToPurchase: string;
  sellerAddress: string;
  saleId: string;
  nonce: string;
  crateID: string;
  signature: string;
}

export type ConsecutivePurchaseReturn = [
  CPRT['contractAddress'],
  [CPRT['toTokenId'], CPRT['commission'], CPRT['amountToPurchase']],
  CPRT['sellerAddress'],
  [CPRT['saleId'], CPRT['nonce'], CPRT['crateID']],
  CPRT['signature'],
  { from: string; value: string }
];

export type SellErc1155Body = {
  ids: string[];
  values: string[];
  price: string;
  contractAddress: string;
  crateId?: string;
  sender: string;
  signature?: string;
};
