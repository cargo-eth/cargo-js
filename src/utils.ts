import { ResaleItemWithMetadata } from './types';

type ResaleItemGroups = {
  [address: string]: ResaleItemWithMetadata[];
};

export default class Utils {
  groupResaleItems(resaleItems: ResaleItemWithMetadata[]): ResaleItemGroups {
    const output: ResaleItemGroups = {};
    resaleItems.forEach(resaleItem => {
      output[resaleItem.tokenAddress] = output[resaleItem.tokenAddress] || [];
      output[resaleItem.tokenAddress].push(resaleItem);
    });
    return output;
  }
}
