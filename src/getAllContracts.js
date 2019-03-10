// @flow
import fetch from 'isomorphic-fetch';

export default async requestUrl => {
  const url = name => `${requestUrl}/v1/get-contract/${name}`;
  const contracts = await Promise.all(
    [
      'cargo',
      'cargoData',
      'cargoSell',
      'cargoFunds',
      'cargoAsset',
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

  console.log(contracts);

  return contracts.reduce((a, b) => {
    a[b.name] = b;
    return a;
  }, {});
};
