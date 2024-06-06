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
