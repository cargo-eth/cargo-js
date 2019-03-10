// @flow
import Web3 from 'web3-eth';
import getAllContracts from './getAllContracts';
type TNetwork = 'local' | 'development' | 'production';
type TCargoOptions = {
  network: TNetwork,
  web3Provider?: Object,
};

const DEFAULT_OPTIONS: TCargoOptions = {
  network: 'local',
};

const REQUEST_URLS: { [TNetwork]: string } = {
  local: 'http://localhost:3000',
  development: '',
  production: '',
};

// By defining the function outside of the class we can
// call the function with .call and simulate a private class method
function setUpWeb3() {
  if (this.isDom) {
    if (window.ethereum) {
      const web3 = new Web3(window.ethereum);
      this.web3 = web3;
      window.web3 = web3;
    } else {
      this.metaMaskRequired = true;
    }
  } else {
    if (!this.options.provider) {
      throw new Error('Web3 provider must be included in options.');
    }
    this.web3 = new Web3(this.options.provider);
  }
}

class Cargo {
  isDom = typeof window !== 'undefined';

  init = async (options: TCargoOptions) => {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    this.requestUrl = REQUEST_URLS[this.options.network];
    this.contracts = await getAllContracts(this.requestUrl);
    setUpWeb3.call(this);
  };
}

export default Cargo;
