export type OrderParams = {
  contractAddress?: string;
  vendorId?: string;
  sellerAddress?: string;
  buyerAddress?: string;
  tokenId?: string;
  crateId?: string;
  from?: string;
  to?: string;
  limit?: string;
  page?: string;
};

export type Order = {
  seller: string;
  buyer: string;
  uuid: string;
  contract: string;
  tokenId: string;
  price: string;
  fees: {
    cargo: string;
    crate: string;
  };
  beneficiaries: { address: string; commission: string }[];
  vendorId: string;
  crateId: string;
  createdAt: string;
};
