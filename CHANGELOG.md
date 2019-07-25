# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2017-06-24

### Added

- Added the PollTx class to easily watch and respond to status of submitted transactions.
- Refactored initialization method. Module now exports unitialized `Cargo` class. Options are now passed into the class constructor.

### Removed

- Removed ability to pass options to `init` function.
- Library no longer exports an already initialized Cargo class. Users now need to initialize cargo via `new Cargo()`.