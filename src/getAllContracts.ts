export default async (requestUrl: string) => {
  const url = (name: string) => `${requestUrl}/v1/get-contract/${name}`;
  const contracts = await Promise.all(
    [
      'cargo',
      'cargoData',
      'cargoSell',
      'cargoFunds',
      'cargoVendor',
      'cargoAsset',
      'cargoBatchMint',
      'cargoTokenV1Creator',
      'cargoTokenV2Creator',
      'cargoToken',
    ].map(name => fetch(url(name))
      .then(res => res.json())
      .then(({ abi, address }) => ({
        name,
        abi,
        address,
      })),
    ),
  );

  return contracts.reduce((a, b) => {
    // @ts-ignore
    a[b.name] = b;
    return a;
  }, {});
};
