export type TokenMetadata = {
  $schema: string;
  $evidence: string;
  description: string;
  image: string;
  metadata: {
    [key: string]: any;
  };
  name: string;
};

export type TokenAddress = string;
export type TokenId = string;
