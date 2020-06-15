# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.5]

- Save signature to local storage w/ account address

## [3.0.4]

- Support ownerAddress when getting tokens by contract
- Add unapprovedFn to sell function
- Change args to object for getContractMetadata function

## [3.0.0]

- Transactions are added automatically to PollTx
- No longer need to call `cargo.init`. Initialization is done in the constructor and now you only need to call `cargo.enable`
- Contract ABIs are fetched as needed rather than upfront.
- Contract ABIs are stored in localstorage to mitigate the need to request them from the server unnecessarily.
- web3 has been added as a peer dependency
- Cargo class is now a named import rather than default.
- Emitter class in now a new named import.
- Return new transaction hash in addition to all pending transactions in 'pending' pollTx event
- Update PollTx event 'pendingUpdated' to 'pending'
- Do not emit pending from completed event in PollTx.
- Update PollTx completed event emit an addition argument which is the updated list of pending transactions.

## [2.2.2]

- Added typescript types to output
- Replaced awesome typescript loader with babel preset and tsc

## [2.2.1] - 2019-09-24

### Fixed

- Bug where batch mint function did not return transaction hash

## [2.2.0] - 2019-09-24

### Added

- Added getOwnedTokensByContract method that supports pagination. Metamask not required.
- Added getContractsWithStake to return all Cargo contracts that a given address owns tokens in.
- Added createBatchTokenContract api method

### Changed

- Updated getMintedTokens api method to use v2. This supports pagination. The response shape has changed.
- Update getSignature method to use web3.personal.sign
- Add batch mint arguments to mint api method

## [2.1.1] - 2019-09-15

### Added

- Added getTokensMetadata to get metadata for a group of tokens
- Update eslint package

## [2.1.0] - 2019-08-06

### Added

- Added getResaleItemsByCrateId to get all resale items in a crate for the given crate ID.
- Initialize PollTx in the init function
- Update cargo.request to take a rawUrl option
- Added groupResaleItems util function

### Fixed

- Fixed bug where wallets like Opera on android do not return accounts array after calling enable()

## [2.0.0] - 2019-06-24

### Added

- Added the PollTx class to easily watch and respond to status of submitted transactions.
- Refactored initialization method. Module now exports unitialized `Cargo` class. Options are now passed into the class constructor.

### Removed

- Removed ability to pass options to `init` function.
- Library no longer exports an already initialized Cargo class. Users now need to initialize cargo via `new Cargo()`.
