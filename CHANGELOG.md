# Changelog

All notable changes to `@recuro/sdk` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning policy

- **Major (`x.0.0`)**: breaking change to a public API - type rename, required-param addition, removal of an exported function, IDL incompatibility.
- **Minor (`0.x.0`)**: new functionality, new exports, additive type changes (optional fields). Always backward-compatible at the source level.
- **Patch (`0.0.x`)**: bug fixes, doc updates, internal refactors. No API surface change.

When upgrading across a major bump, read the migration notes in this file before bumping the version pin in `package.json`.

---

## [Unreleased]

### Added

- Concepts page with full architecture diagram and glossary (`docs/concepts.md`).
- Comprehensive error reference (`docs/errors.md`) - every Anchor error code, its trigger, and the fix.
- Types reference (`docs/types.md`) - all exported types, interfaces, and enums.
- Troubleshooting & FAQ (`docs/troubleshooting.md`) - common integration issues.
- Recipes folder (`docs/recipes/`) - short copy-pasteable how-tos for the most-asked integration questions.
- QVAC AI Assistant documentation for merchant-dashboard (`docs/for-merchants/qvac-assistant.md`).

### Changed

- Updated `docs/SUMMARY.md` to surface the new pages.

---

## [0.x.x] - example past entry shape

### Added

- _Describe new exports, hooks, methods._

### Changed

- _Describe behavior changes that callers should know about._

### Deprecated

- _Mark APIs that still work but will be removed next major. Include the suggested replacement._

### Removed

- _List APIs removed in this version. Always a major bump._

### Fixed

- _Bug fixes._

### Security

- _Security-relevant fixes - call out CVEs or scope of impact._

---

## Migration guides

### From `0.x` → `1.0` (when 1.0 ships)

When v1 lands, this section will list:

- Renamed exports with their old → new names.
- Removed methods with replacement instructions.
- Type-shape changes that require updating consumer code.
- Any IDL incompatibilities (re-running `yarn anchor:idl` will be required).

---

> 💬 Found an issue or have a question?
> [Open an issue on GitHub](https://github.com/AlexNaskida/recuro-sdk/issues)
