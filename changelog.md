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
- 

# 3.8.2
- Prevent executing "empty" command on streaming
- Unlock mouse on system dialogs (gnome related issue)