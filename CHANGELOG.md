# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-06-24

### Added
- Created unit tests verifying domain-based duplicate grouping and sorting by system index.
- Added full URL hover tooltip on duplicate bookmark items.

### Changed
- Modified bookmark rendering order to follow the system bookmarks bar index (`index` property in Chrome database) instead of always placing folders first.
- Updated "Find Duplicates" algorithm to group bookmarks by domain name (hostname) instead of exact URL matches. Clicking a duplicate now correctly opens the specific item's URL.
- Redesigned and scaled up the Help icon (question mark `?`) to remove the outer circle and match the visual size and weight of other toolbar icons.
- Replaced the triple dots (`...`) icon with a scanning box icon to better represent the actions panel's positioning.

## [1.0.0] - 2026-06-19

### Added
- Initial release of WideMark Chrome Extension.
- Compact side panel bookmark browsing, search, and organization.
- Local duplicate bookmark checker.
- Custom folder styling (colors and icons) and persistence.
