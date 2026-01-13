# 3.19.4 (13.01.2026)

## Changes
- Performance improvements: Offloaded search to a separate task, reducing UI lag and making parsing with active filters up to **1.4X faster**.

# 3.19.3 (12.12.2025)

## Changes
- Use PowerShell as default shell on Windows when available.
- List built-in PowerShell on Windows in the available shells.

# 3.19.2 (10.12.2025)

## Features
- Add Templates and Example plugins development with C/C++.
- Enabled support for complex shell commands, including piping and inline environment variables.

## Changes
- Resolved Antivirus false positives by checking for well-known shells without execution, instead of executing all installed shells at startup.
- Improved error reporting to display native shell errors instead of generic IO failures.
- Fix used counter in filter presets view

# 3.19.1 (13.10.2025)

## Fixes
- Fixed issue where export as table for binary sources (DLT, SomeIP, etc.) was exporting empty content.
- Prevented duplicating filter presets when applying them.

## Changes
- Remove all remaining automatic update artifacts on startup.
- Dropdown texts changed to Title Case.

# 3.19.0 (26.09.2025)

## Features
- Significant performance improvements: Binary file processing is now up to **3X faster**.
- Add Tailing support for binary files (now supports both text and binary).

# 3.18.7 (11.09.2025)

## Changes
- CLI arguments for multiple files now open a multi-file view instead of concatenating.
- CLI: Glob matches are now sorted alphabetically.
- CLI: Multiple glob patterns now append results instead of overwriting.

# 3.18.6 (10.09.2025)

## Fixes
- Consider Parser-type CLI argument for launching with file paths.
- Fix starting file concatenation sessions via command-line arguments.

# 3.18.5 (05.09.2025)

## Fixes
- Stop file tailing on file truncate.

# 3.18.4 (29.08.2025)

## Changes
- Fixes empty filters after opening files from a quick navigation prompt.
- Tab "Presets/history" now automatically activates after importing filters.
- "Recently added" filters now shows previous imports on duplicate imports.

# 3.18.3 (21.08.2025)

## Fixes
- Switch to native clipboard API.

# 3.18.2 (19.08.2025)

## Add
- Support for `Ubuntu 20.04` in release and updater.
- Confirmation dialog on remove plugin in plugins manager.

## Fixes
- Include logs from all Rust core components by default.
- Show correct filter name in file picker dialog (for Linux).
- Fix preview attachments issue on Windows.  

# 3.18.1 (02.06.2025)

## Fixes
- Fix application menu (for macos)
- Allow open external links in changelogs overview
- Fix listing of parsers
- Fix files filtering (on dialogs)

# 3.18.0 (30.05.2025)

## Add
- Add support of wasm plugins for custom parsers/sources

# 3.17.2 (26.05.2025)

## Changes
- Update inner dependencies in Cargo.lock files

# 3.17.1 (23.05.2025)

## Fixes
- Fix for loading corrupted DLT files (statistics collecting)
- Fix for error reporting during DLT statistics collecting

## Changes
- Update documentation 

# 3.17.0 (12.04.2025)

## Fixes
- Fix the scrollbar issue (disappeared on tab switch)
- Fix local storage (on save)

## Features
- Add support of multiple themes
- Add Light Theme

# 3.16.6 (06.04.2025)

## Fixes
- Fix sticky scrolling issue

## Changes
- Refactoring an infrastructure of parsers

# 3.16.5 (28.03.2025)

## Changes
- Upgrade DLT parser version
- Add TCP reconnection support
- Refactoring to fit cancel safe requirements

# 3.16.4 (21.03.2025)

## Fixes

- Fix single bookmark issue

## Changes

- Extend the context menu on a tab-title

# 3.16.3 (14.03.2025)

## Fixes

- Fix DLT file / source reading
- Fix DLT filtering

# 3.16.2 (26.02.2025)

## Fixes

- Change a traget platform to build linux version

# 3.16.1 (20.02.2025)

## Fixes

- Fix handling of large incoming packets in TCP/UDP servers.

# 3.16.0 (05.02.2025)

## Features

- Allow saving session state into a file (state includes: filters, charts, and disabled entities)
- Allow import filters, charts, and disabled entities from a file into the current session.

## Fixes

- Fix drag & drop files

# 3.15.3 (03.02.2025)

## Fixes

- Fixed an issue related to navigation in a nested search
- Fixed an issue related to navigation in a major search

## Changes

- Bind "Enter" with the next result in a nested search
- Boost scrolling rate to better support touchpads

# 3.15.2 (31.01.2025)

## Fixes

- Fixed an issue related to hashing row's state

# 3.15.1 (30.01.2025)

## Fixes

- Fixed an issue related to breadcrumbs
- Fixed an issue with updating rows in views

# 3.15.0 (27.01.2025)

## Features

- Add support for nested search in the search results

## Changes

- Upgrade Angular version to 19.x
- Upgrade Electron version to 34.x
- Upgrade the rest npm packages to recent versions

## Developing

- Update build CLI

# 3.14.4 (08.01.2025)

## Changes

- Using binary format for messaging instead of JSON strings

# 3.14.3 (15.11.2024)

## Corrections

- show recently added filters after importing
- add parsing of DLT payload's network prefix

# 3.14.2 (08.11.2024)

## Corrections

- better parsing Some/IP in the scope of DLT Network Trace
- cleanup temporary session files

# 3.14.1 (28.10.2024)

## Corrections

- allow select columns, which will be exported into a file on search results export
- suggest default file name on exporting and saving of attachments

# 3.14.0 (25.10.2024)

## Features

- allow select columns, which will be exported into a file

## Developing

- add additional tests for exporting functionality

# 3.13.5 (21.10.2024)

## Fixes

- fix export feature

# 3.13.4 (21.10.2024)

## Fixes

- sanitize the attachment path before saving
- prevent closing session on invalid attachment

## Changes

- add support for multiple values/messages on the producer level

# 3.13.3 (18.10.2024)

## Fixes

- fix a filters on selecting file dialog

# 3.13.2 (04.10.2024)

## Changes

- pretty printing Some/IP payloads

## Fixes

- fixed sticky scrolling for files and streams

# 3.13.1 (27.09.2024)

## Changes

- improve performance of parsing Some/IP messages from DLT payload
- import filters/chars/disabled from parent session on new one based on search results

# 3.13.0 (19.09.2024)

## Fixes

- prevent requests to the nearest position (search results) on empty results

## Changes

- remove "Copy As Formatted Table"
- apply formatted coping as soon as the render is columns

## Features

- add support Some/IP messages from DLT payload

## Developing

- switching build workflow from ruby scripts (rake) to own build CLI module
- add benchmark tests to keep control of performance

# 3.12.9 (06.06.2024)

## Fixes

- Fix issue with non-UTF8 symbols in paths (recent actions)

# 3.12.8 (24.05.2024)

## Fixes

- Fix issue on stopping observing

# 3.12.7 (17.05.2024)

## Changes

- Allow open files from favorites by dblclick

## Fixes

- Fix the import/export presets feature
- Fix logger. Make it react to envvars correctly

## Updates

- Upgrade electron version

# 3.12.6 (10.05.2024)

## Changes

- Up electron version to 30.x.x

# 3.12.5 (08.05.2024)

## Changes

- Check filters/charts during importing
- Highlight invalid filters/charts in sidebar
- Prevent search with invalid conditions
- Better error reporting on search fail
- Correction of filters/charts styles (sidebar)
- Allow modification of invalid filters/charts

# 3.12.4 (19.04.2024)

## Fixes

- Fix parsing disabled entities (filters/charts)

# 3.12.3 (19.04.2024)

## Changes

- Optimization of the events life cycle of filters/charts/disabled

# 3.12.2 (19.04.2024)

## Changes

- Optimization for "History/Presets" tab

# 3.12.1 (16.04.2024)

## Fixes

- Fix issue related to invalid UTF-8 and Unicode

# 3.12.0 (12.04.2024)

## Features

- Allow export a session state as CLI command

## Changes

- Update UI related to tabs

# 3.11.2 (22.03.2024)

## Changes

- Allow custom entry-point for teamwork

## Fixes

- Fix loading metadata for teamwork for new files
- Suggest action on merge conflicts (teamwork)

# 3.11.1 (22.03.2024)

## Fixes

- Fix create/update/change repo issue in context of Teamwork feature

# 3.11.0 (22.03.2024)

## Fixes

- Fixed bookmarks update event
- Fixed "/" shortcut

## Features

- Add feature "teamwork" for sharing session data between users
- Add feature "comments" to comment content of file

# 3.10.9 (15.03.2024)

## Fixes

- Fix 7-key issue

## Changes

- Upgrade electron to 29.x

# 3.10.8 (01.03.2024)

## Changes

- Change closed chunk char for sending into serialport

# 3.10.7 (01.03.2024)

## Changes

- Change a way of file nature checking (text/binary)

## Features

- Added "Export All" to main output context menu

# 3.10.6 (09.02.2024)

## Fixes

- Fix calling recent commands
- Fix context menu in concat view
- Fix files list in concat view

# 3.10.5 (02.02.2024)

## Fixes

- Updated `envvars` version to fix flashing of console windows on chipmunk startup via icon on Windows

# 3.10.4 (05.01.2024)

## Fixes

- Fix shutdown application workflow errors

# 3.10.3 (10.11.2023)

## Fixes

- Fix labels on chart

# 3.10.2 (30.10.2023)

## Fixes

- Review/rework the selection procedure

# 3.10.1 (27.10.2023)

## Fixes

- Selecting in the scope of one row

# 3.10.0 (26.10.2023)

## Fixes

- Fix SDE spinner on command spawning
- Fix white space rendering
- Fix exporting data from text files

## Features

- Allow open search results in a new session
- Allow download updates from pre-releases (optional)

# 3.9.22 (20.10.2023)

## Fixes

- Fixed concat view style issues

## Changes

- Updated styles on `Ctrl + P` popup
- Support for continued movement on `Ctrl + P` popup

# 3.9.21 (19.10.2023)

## Changes

- Updated `envvars` dependency

# 3.9.20 (18.10.2023)

## Fixes

- Fixed text selection bug

## Changes

- Updated `envvars` dependency

# 3.9.19 (17.10.2023)

## Updated

- Updated envvar version

# 3.9.18

## Fixes

- Fix DLT header parsing with TZ condition

# 3.9.17

## Changes

- Add DLT/SomeIp configuration short info into the status bar
- Change a way to copy data into the clipboard from a stream

## Fixes

- Fix the width issue on columns view
- Fix concat files view
- Fix supporting of TimeZones on DLT
- Fix FIBEX files select/unselect

# 3.9.16

## Changes

- Set a new active search if the input isn't empty (instead of adding a filter)
- Change linking profiles on suitable types of files/sources
- Allow configure default colors for filters, matches and charts

# 3.9.15

## Changes

- Upgrade electron and related dependencies

# 3.9.14

## Changes

- Remove version prefix ("next-")

# 3.9.13

## Changes

- Add support of updating from all published versions

# 3.9.12

## Fixes

- Fix the path's parser (windows)
- Fix the default column's sizer
- Fix DLT statistic collector

# 3.9.11

## Features

- Possibility to manage columns styles

## Fixes

- Move global drag and drop controller into service
- Fix multiple selecting attachments
- Append default extension to saved attachments
- Fix attachments preview styles
- Correct writing of client logs
- Addition logs

# 3.9.10

## Fixes

- Fix scrolling error
- Fix dialog styling
- Fix drag and drop files support
- Show connection errors to the user
- Fix text selecting
- Fix copy to clipboard issue
- Fix Ctrl/Cmd + C on details view

# 3.9.9

## Fixes

- Fix opening DLT files

# 3.9.8

## Features

- Allow custom path for serial port connections
- Allow sending data into serial port with delay
- Added user manual
- Added tab with release information
- Added possibility to import filters/charts from Chipmunk v.2

## Fixes

- Fixed scroll bar issue on sticky scrolling
- Fixed saving of recent terminal commands
- Fixed respawning new terminal commands
- Fixed 1 line stream spawning
- Fixed range error in 1 line streams

# 3.9.7

## Features

- Add mixed popup (Ctrl + P / Cmd + P) to show recent action(s) with files from favorites places

# 3.9.6

## Fixes:

- Remove a screen locker on concat operation
- Reduce a time of the first feedback on concat

# 3.9.5

## Fixes:

- Fix scrolling issue for recent actions list
- Fix opening files from favorites and recent
- Serialize html on row before apply highlights
- Correct search export to file
- Add lock screen on concating files
- Fix sorting and UI issues on concat
- Extend max sources number to 65535 (from 255)

## Features

- Add support of PCAP file format

# 3.9.4

## Fixes:

- Fix issue with same source UUID on restarting source

# 3.9.3

## Features

- Import / Export filters from context menu on sidebar

## Fixes:

- Fix quick observe setup

# 3.9.2

## Fixes

- Creates suitable source for exporting as raw
- Allows export SomeIp into binary from PcapNg
- Fixes issue with exporting DLT from PcapNg
- Allows attaching to same session text & binary files after concat operation was done
- Fires error on attempt to attach a file to session with linked session file

# 3.9.1

## Fixes

- fix error related to overwriting configuration of observing (stream/parser)

# 3.9.0

## UI/UX & Features

- add support of SomeIp in PcapNg files
- add support of modules for SomeIp
- reintroduce UI/UX for opening binary files
- reintroduce UI/UX for connection to the source

## Developing

- add traces on errors (traces drops into a console and saves into the log file)
- fix the focus issue on DevTools in the client
- unlock shortcuts in DevTools

## Internal

- sync types from rustcore to client in the scope of observing operations
- remove duplicates of types
- Angular upgrade to 16.x
- Upgraded all npm modules
- Fix timing issue for jobs on ts-binding (unbound session on rustcore)

# 3.8.2

- Prevent executing "empty" command on streaming
- Unlock mouse on system dialogs (gnome related issue)
