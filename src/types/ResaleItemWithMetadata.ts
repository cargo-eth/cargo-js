import { TokenMetadata } from './TokenMetadata';

export type ResaleItemWithMetadata = {
  metadata: TokenMetadata;
  fromVendor: boolean;
  price: string;
  resaleItemId: string;
  sellerAddress: string;
  tokenAddress: string;
  tokenId: string;
};
