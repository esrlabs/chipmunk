## Design & Architecture

The most important change of Chipmunk 3: all stuff related to IO, calculations, parsing etc has been completely moved to the rust core.

All functionality is integrated into electron as native modules. This allowed us to cover the  major functionality by tests and while at the same time achieving a high and stable performance.

## Plugins & Contribution

In Chipmunk 3 we decided to remove the javascript way to add in new functionality. So no classic plugins are supported anymore.
New features that were added in javascript simply did not match our expected performance and scalability goals.
But that doesn't mean that Chipmunk is not extensible. We came up with a new design for our supported parsers and file formats that allows to easyily extend Chipmunk with new parser for the new data types.
It actually became easier to add support for new parsers. Our traits (interfaces) for the parser are clean and minimalistic - no need to research the plugin's API - all you need is to implement the parser's trait and make a pull request.
The integration of new parsers and new sources of data became simpler, even if it isn't based on plugins anymore.

Take into account that some form of plugins might be back, but only on the front-end layer.

## Not yet included features

Considering technical reasons and with generally limited resources, Chipmunk 3 do not yet include the following features:
(but they will be added soon)

- [x] Charts based on parsed values
- [ ] Time measurement
- [ ] Merging of files by found timestamp
- [ ] DLT log message details
- [ ] Setting colors for columns, hide/show columns (related to column based content like DLT)
- [ ] ADB Plugin
- [x] Serial Plugin

## New features

### Tail

Any opened file will be tailed by default. (in the fasion of `tail -f logfile`)

### Combination sources and parsers

The design of Chipmunk 3 allows combine parsers and data-sources in all possible ways. e.g. you can read plain-text content from TCP/UDP connection or read DLT logs from it.

### Supported formats of data & representation of data

- plain text
- ansi colored text
- DLT logs
- DLT contained in pcapng files (wire shark traces)

## UI Updates

### Home screen

Chipmunk 3 has a home screen. In this area, you can get quick access to favorite actions, files in favorite places, and your recent actions.

### Recent actions

Chipmunk 3 saves not only information about recently opened files but about all your recent actions.

For example, if last time of usage you used a connection to a serial port, you will be able to easily restart the connection just with one click.

### Filters and searches

Chipmunk 3 saves recently used filters (searches) and associates them with data sources. It allows you easily restore your collections of filters for example by file types.

### New shortcuts

With `Ctrl + P` / `Cmd + P` you can get quick access to any file from your favorite place. All you need - just add your favorite location and Chipmunk will show files from there.

`Ctrl + Shift  + P` / `Cmd + Shift + P` now shows recently opened files AND all recent actions: recently opened files, connections, and streams.

## Major features

- read files without limitation of size
- fast search
- support multiple search terms
- concatenation of the same format files into one
- bookmarks
- read DLT traces from files, TCP or UDP
- read DLT traces from PCAPNG files
- listening TCP, UPD, and Serial connections
- capture output of CLI commands
- export data into an original format or text format