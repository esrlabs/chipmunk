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