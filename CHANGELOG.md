# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2019-09-18

### Changed

- Updated getMintedTokens api method to use v2. This supports pagination. The response shape has changed.

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
