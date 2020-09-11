# Changelog

### [2.7.1] - 09/11/2020
* Fix pcap file reading
  pcap file reading was broken in multiple ways. We now
  try to parse as much as possible and discard corrupt
  messages without stopping
  A new function was added that allows to convert from a pcapng
  file to a dlt file. There is not yet a binding for javascript
  code.
  closes #899
* better filtering
* Upgrade bytes crate dependency
* Fix pcap file parsing blocking
* Remove output to stdout in launcher
* Remove popup modifications
* Revert "[#642](feat) rework dlt column formatting options"
  This reverts commit 54f7446cc316795a6951af41d4a3b01f4eab22c5.
* [](refact) Apply review changes
* [#642](feat) rework dlt column formatting options
* [#661](fix) Create directive to always focus popup
* [#661](feat) Open DLT file when enter pressed
* [](refact) Refactor code of droplist logic
* [#898](fix) Adjust focus sensitivity of droplists
* [#894](fix) Fix drag&drop for filters placeholder
* [#661](refact) Close dialog on left-click outside
* [#661](fix) Close dialog when left-click outside
* [#894](refact) Fix viable check and refactor lists
* [#894](refact) Move logic into provider class
* [#894](fix) Move logic into provider and fix it
* [](refact) Refactoring of get methods
* [#894](feat) En-/Disable drops in lists
* [#894](feat) Allow valid filter drop in chart list
* [#661](feat) Close dialog when left-click outside
* [#664](feat) Any context menu close on ESC
* [#893](fix) Save chart search on keyboard shortcut
* [#894](feat) Drag&Drop between filters/charts list

### [2.7.0] - 08/28/2020
* []() Remove line
* [#889](fix) Fix for drag&drop animation over bin
* [#889](fix) Apply droplist animation fix
* [#886](refact) Move methods into directive
* [#889](fix) Drop into filter list when empty
* [#886](fix) Files goes back into orignal list
* [#737](fix) Remove entity only when dropped in bin
* [](refact) Small refactoring
* [#737](fix) Fix moving bin on hover
* [#737](refact) Move remove method into directive
* [#737](feat) Add bin to remove filter/chart/etc.
* [#874] Addition UI for defaults values in time measurement view
* [#874] Support recent formats
* [#874] UI for recent datetime format
* [#874] Timemeasurement view: remove tested sidebar; add statebar

### [2.6.2] - 08/20/2020
* [#887] Add support of meta keys for macos to copy selection into clipboard
* [#887] Cleanup content before copy to clipboard
* [#887] Support hotkey to copy selected rows and support copy from search view
* [#887] Main output: copy selected rows into clipboard (if no selected text).

### [2.6.1] - 08/19/2020
* Fix markdown styles

### [2.6.0] - 08/19/2020
* [#879] Support timestamp highlighting on DLT row
* [#216] Update app menu on state change
* [#216] Fix pwd declaration way via args of cmd
* [#216] Fix launcher and CLI caller (linux)
* [#216] Fix launcher for windows
* [#216] Fix loggin for CLI app
* [#875] Get rid of using "::" in args of execution line
* [#216] Move cli caller to apps folder
* [#206] Js lint fixes
* [#216] Open files on CLI call
* [#216] Update build workflow
* [#216] Add cli executor
* [#860](fix) Fix circular dependencies
* Merge branch 'master' into master
* [#867] Using control-key instead cmd-key on mac (to switch tabs)
* [#867] Switch tabs using hot keys
* Revert "[#739](feat) Add shortcuts to save filter/chart"
  This reverts commit 214e64e5ce6f447098b8ad95706393c44d32f037.
* Revert "[#739](fix) Switch to tab "search""
  This reverts commit 7b2d59da92cdd619c3bbaa5025a28f37eb4bea94.
* Revert "[#739](refact) Add tooltips to shortkey descr."
  This reverts commit 9eb0838906683dedf4216b55c5ae8f6f203d0be1.
* Revert "[#739](refact) OS detection to seperate service"
  This reverts commit 73f475e460a527fa99cd6805443c93c9632a60f4.
* Revert "[#739](refact) Promise cleanup"
  This reverts commit 1cf632cca4d661282b13934a83b23ec28e9d5034.
* Revert "[#736](fix) Switch tab on "Show Matches""
  This reverts commit 8580da12046494d2b1fde295bacc50c935cecdf7.
* Revert "[#736](refact) Create service for common functions"
  This reverts commit 820f07e0bae0c8ae1fe8adf23e01fb4e541882c5.
* Revert "[#735](fix) doubleclick show matches new structure"
  This reverts commit 325f12656cd9ad50844b775d258ef40e49f7a3f6.
* Revert "[#736](refact) Apply requested changes"
  This reverts commit c636305db29c80408977ec9b105a8bd6de5b8110.
* Revert "[#860](fix) Ignore Ctrl button when saving"
  This reverts commit 82c678480c26718e45265b9672b44af2cc702196.
* Revert "[#736](refact) Change private methods to public"
  This reverts commit 8020c7c6b54d110c5031a4fe688438b86877ee80.
* Revert "[#860](fix) Ignore Shift/Ctrl button on shortcut"
  This reverts commit 8339834eb42ca216581527715a02576458f8829a.
* Revert "[#736](refact) Create service for toolbar"
  This reverts commit 15beab672fa972cc2106c7b2252a35ea12df407f.
* Revert "[#736](fix) Fix search for disabled components"
  This reverts commit 04cf9d1f8a7213f98fa664aa679072ee2d726b17.
* Revert "[#735](fix) Ignore click when doubleclick"
  This reverts commit 7630d89c61978c075450e68c3a02afa4687fba32.
* Revert "[#735](fix) Remove Timeout"
  This reverts commit 23d160c5443b3d1412b2e7989b5cbb9a3b642fd9.
* Remove unnecessary output
* Fix windows compilation
* Fix compile error under windows
* Take care that the log-config file is correct
  avoid writing to a folder named \$HOME_DIR (fixes #802)
  format rust code
  add raketask to format rust code and to check with clippy
  introdude anyhow instead of failure
* [#735](fix) Remove Timeout
* [#735](fix) Ignore click when doubleclick
* [#736](fix) Fix search for disabled components
* [#736](refact) Create service for toolbar
* [#860](fix) Ignore Shift/Ctrl button on shortcut
* [#736](refact) Change private methods to public
* [#860](fix) Ignore Ctrl button when saving
* [#736](refact) Apply requested changes
* [#735](fix) doubleclick show matches new structure
* [#736](refact) Create service for common functions
* [#736](fix) Switch tab on "Show Matches"
* [#739](refact) Promise cleanup
* [#739](refact) OS detection to seperate service
* [#739](refact) Add tooltips to shortkey descr.
* [#739](fix) Switch to tab "search"
* [#739](feat) Add shortcuts to save filter/chart
* [#735](fix) Remove Timeout
* [#735](fix) Ignore click when doubleclick
* [#736](fix) Fix search for disabled components
* [#736](refact) Create service for toolbar
* [#860](fix) Ignore Shift/Ctrl button on shortcut
* [#736](refact) Change private methods to public
* [#860](fix) Ignore Ctrl button when saving
* [#736](refact) Apply requested changes
* [#735](fix) doubleclick show matches new structure
* [#736](refact) Create service for common functions
* [#736](fix) Switch tab on "Show Matches"
* [#739](refact) Promise cleanup
* [#739](refact) OS detection to seperate service
* [#739](refact) Add tooltips to shortkey descr.
* [#739](fix) Switch to tab "search"
* [#739](feat) Add shortcuts to save filter/chart
* Lint js errors correction
* [#866] Add files writing queue.
* Fix switching to edit-mode (search manager)
* Remove unused items from context menu (search manager)
* Use "scaled" move for time measurement as default
* [#865] Support key SHIFT for multiple selection
* [#863] Correct lint js errors
* [#863] Implemented 2 states of render: inited and ready
* [#861] Add release notes tab
* Apply updated npm resolutions list
* Update resolutions list
* [#857] Show full filename on hover of tab
* [#853] Autosaving of entities (filters/charts/ranges/disabled)
* [#853] Fix keyboard-navigation across entities lists
* Correct dropping charts/filters/ranges on load data from file
* [#834] Add back compatibility to load filters/charts
* Fix row parser. Using UTF control codes for match-placeholders
* [#834] Fix drag & drop along disabled items bug
* [#834] Upgrade save/load controller (for filters/charts/ranges/disabled)
* [#834] Support drag & drop from disabled to charts/filters/ranges
* [#834] Disable entity (filter/chart/range) on drag & drop
* [#834] Basic support of disabling filters/requests/ranges
* Resolve npm security issues
* Fix update error on tab's content controller (chipmunk.client.components)
* [#853] Add support of multiple time range filters
* [#853] Remove active/deactive state from time-range
* [#853] Use scrict oreder of providers in the scope of search manager
* [#853] Select just created entity as default
* [#853] Drop details view on removing of entity
* [#853] Use command instead control on OSX
* [#853] Fix style of ranges in scope of row
* [#853] Support scrict and not-strict modes for time ranges search
* Fix JSLint warnings/errors
* [#853] Add support multiple points in scope of the time range
* [#853] Fix cursor position for timemeasure charts
* [#853] Add posibility to change a color of time ranges
* [#853] Update context menu of time ranges
* [#853] Insert multiple ranges
* [#853] Resolutions for npm modules
* [#853] Update clhipmunk.client.toolkit 1.2.15 -> 1.2.16
* [#853] Add processor of time range searches
* [#853] Lint js corrections
* [#853] Add UI in search manager for time ranges
* [#853] Added basic views for time ranges in search manager
* [#853] Add basic controllers for time ranges (hooks)
* [#853] clean up context menu of search manger
* [#853] added context menu support via provider of search-manager-data
* [#853] select in search manger a filter/chart/others on keyboard event
* Fix bug with dynamic component update
* [#853] refactoring search manager (render)

### [2.5.3] - 07/15/2020
* [](fix) fix fsevent module issue (mac, client.core)
* [](fix) fix node-gym and fsevent errors related (mac)

### [2.5.2] - 07/14/2020
* [](fix) time measurement chart: fix resize on sidebar on/off
* [](feat) time measurement chart: selection in overview
* [](fix) update zoom/cursor state without active view
* [](fix) time measurement: fix scale restoring on range removing
* [](fix) fix security npm issues
* [](feat) time measurement chart: support horizontal scrolling on mac-touch pad
* [](fix) time measurement: correct restore scale in overview
* [#844](refact) remove docker from chipmunk.client.components
* [#844](refact) get rid of docker usage (client)
* [](fix) resolve npm security issues
* [](feat) add once-executable event's handle

### [2.5.1] - 07/08/2020
* [#835](fix) correct error handling on time discover
* [](feat) close button for tabs (toolbar)
* [](feat) add notifications tab with first notification
* [#835](fix) skip timestamp check on empty session
* [#835](feat) check timestamp on active view
* [](feat) upgrade node: 10.16.3 -> 12.14.0
* [](fix) upgrade electron-notarize to 1.0.0
* [](fix) downgrade electron-notarize to 0.2.1
* [](chore): version bump from 2.4.1 => 2.5.0

### [2.5.0] - 07/07/2020
* [#835](fix) fix ordering of rested ranges in group
* [](feat) upgrade electron to 9.1.0
* [#835](feat) export data into csv file
* [#835](feat) wheel on cursor (zooming)
* [#835](feat) shift + wheel: horizontal scrolling
* [#835](fix) fix output context menu
* [#835](feat) redirection to first row in range
* [#835](feat) update context menu (main output)
* [#835](feat) compress long durations
* [#835](feat) onfly range border (main view)
* [#835](feat) close range on ctrl + click (on time value)
* [#835](feat) create range by selection(s)
* [#835](feat) update zoom controlls
* [#835](fix) correct distance lines
* [#835](fix) fix order of ranges on chart
* [#835](feat) auto open timemeasure tab
* [#835](feat) zoom limitation on wheel
* [#835](fix) fix calculation of chart's height
* [#835](feat) get most suitable color for new range
* [#835](fix) hide context menu if timestamp isn't detected
* [#835](refact) change nested ranges logic
* [#835](feat) support "add range" on time click
* [#835](fix) lint
* [](fix) correct remove sidebar on "no sessions" state
* [](fix) destroy secondary area (toolbar) on "no sessions" state
* [#835](fix) correct update cursor and zoom on remove range
* [#835](fix) drop zoom if all ranges are removed
* [](fix) fix error on "no sessions" state (tabs controller)
* [#835](feat) remember cursor and zoom state per sessions
* [#835](fix) correct removing ranges
* [#835](fix) lint
* [#835](feat) zooming and overview cursor
* [#835](feat) timeline overview
* [#835](feat) using scatter chart render for all modes
* [#835](feat) time ranges charts: full support vertical scrolling
* [#835](feat) time ranges chart: scrolling area
* [#835](feat) change time range selection
* [#835](feat) update time ranges render in the scope of row
* [#835](refact) update times ranges render on row
* [#835](refact) time ranges: multiple ranges support
* [#835](refact) refactoring of timestamp controller (muliple ranges support)
* [#835](feat) time measurement:: support scaled chart type
* [#835](feat) move chart data processing into service
* [](feat) core: dynamoc tab-service switching
* [](feat) chipmunk-client-material:: support dynamic tab's service change
* [](feat) update time measurement service
* [](feat) update time measurement controller
* [](feat) update IPC in scope of time measurement
* [](fix) typo in panel caption
* [](fix) cleanup colors scheme
* [](feat) updated time measurement controller
* [](feat) switching to panels (time measurement)
* [](feat) UI to define a start point (time measurement)
* [](feat) support extrating datetime with time only
* [](feat) datetime replacement for indexing timestamp
* [](feat) indexer: optionally skip MM, DD, YYYY for format check
* [#672](feat) support "add tab" functionlity
* [#672](fix) fix update service workflow
* [#797](fix) Fix buggy output
* [#665](refact) Comment about extra event handler
* [#797](fix) Check for error message
* [#797](refact) Apply review changes
* [#797](fix) Add version detection for linux
* [#797](fix) Fix release version in about tab
* [#665](fix) Fix error on no suggestion
* [#665](feat) Search input support TAB
* [#745](fix) Mark empty file as 'problem file'

### [2.4.1] - 06/19/2020
* [](fix) fix recent filter saving

### [2.4.0] - 06/19/2020
* [#821](fix) fix notifications minimal width
* [#821](fix) prevent notification on timestamp discover
* [#821](feat) allow miss year in format
* [#821](feat) runtime format match highlight
* [#821](fix) fix toolkit on timestamp selection
* [#821](feat) tooltip API (without plugins support)
* [#821](feat) add session parser for rows
* [#821](feat) addition IPC
* [#821](feat)indexer: addition API
* [#821](feat) multiple formats support
* [#821](feat) manage formats (UI)
* [#821](feat) support stacked charts
* [#821](feat) addition functions into context menu
* [#821](feat) switch to chart.js
* [#821](feat) ranges in main view
* [#821](feat) correct IPC messages format
* [#821](feat) template of measurement view and controller
* [#821](feat) new service to detect a timestamps
* [](chore): version bump from 2.3.0 => 2.3.1
* [#825](fix) Color only on search term not all span
* [#825] Apply requested changes
* [#706](feat) New search algorithm; blue highlight
* [#707](refact) Apply requested changes
* [#707](refact) Service for recent files
* [#707](feat) Add exporting file to recent files
* Updated package-lock files
* Indexing datastructure refacturing
  * simplify indexing config with owned data
  * fix neon bindings for updated indexing config type
* Format code & remove warnings
* Dismiss deprecated failure library in favor of anyhow
  Rework error-handling: Use anyhow and thiserror instead
* Introduce async apis
* Restructuring of merger
  * adjust api for merging
  * Refactoring of merger to make it testable
  * add merger functionality in main
  * neon indexer changes for new API for merging
  * iterator for dlt
  * simpler data types for merging

### [2.3.1] - 06/10/2020
* [#822](feat) Context menu
* [#822](refact) No selected no action

### [2.2.0] - 04/11/2020

* [#780](feat) support multiple dlt messages in a udp frame
  closes #780
* [781](fix) correct tasks queue for charts requests (close #781)
* [769](fix) store last selection for details view (close #769)
* [602](feat) add axisY to chart
* [602](feat) drop selection on tab change (close #602)
* [723](refact) change default settings for charts
* [778](fix) show bookmarks with empty search results (close #778)
* [](fix) fixing security issues (resolution dependencies)
* [773](fix) update file size on recent dialog (close #733)
* [](fix) fix search input focus issue (mac)
* [](fix) use as default file-parser text-parser (for any type of not-supported files)
* [](fix) correct number of updates/upgrades of plugins
* [#743](fix) fix key-holder for rows selection

### [2.1.2] - 03/29/2020
* [](fix) add better errors for UDP DLT connections

### [2.1.1] - 03/28/2020
* [](chore) fix rakefile problems

### [2.1.0] - 03/28/2020
* [](fix) use tmp folder in .chipmunk for backup
  make rollback tarball creation faster
* [](fix) fix closing of app on mac
* [#752](feat) do rollback when update was not successfull
  move launcher and updater to cargo workspace
  added miniapp
* [](feat) safe downloading of updates
* [](feat) plugins view: search support
* [](feat) update plugin manager view
* [](feat) update plugins view
* [](feat) chipmunk.client.toolkit update to 1.0.3
* [](feat) angular 8.x --> 9.x
* [](feat) terminate electron process also for ctrl-c
* [](fix) provide default config in launcher
* [#747](feat) support another date format in timestamp recognition
* [](feat) update versions of dependencies
* [](chore) provide bug report and feature request templates

### [2.0.2] - 03/17/2020

* [](fix) recognize timestamp with greater then millisecond accuracy
* [](feat) update plugins install/uninstall workflow
* [](feat) update "about" tab

### [2.0.1] - 03/16/2020

* [](fix) build correct windows update package
* [](refactor) add support for dlt statistics for live stream
* [](fix) prevent direct access to active session
* [](fix) fix opening file issue with active custom tab
* [](feat) add "about" tab
* [](feat) support of custom tabs (not bound to session)

### [2.0.0] - 03/14/2020

* Update to new repository structure: all plugins have been moved to
  https://github.com/esrlabs/chipmunk-plugins-store
* [#702](feat): zip artifact for windows build
* [#702](refactor): refactor launcher and updater
  add some logging to update
* DLT: Add support for enums
* [](fix) fix bookmarks navigation via hotkeys
* [](fix) fix issue with position of autocomplete panel
* [](feat) remove downloaded plugin after unpack
* [](fix) load default plugins on start
* [](fix) darwin close app issue fix
* [](feat) update/install plugins on close
* [](fix) fix close application issue
* [](feat) support of icon in plugins view
* [](feat) electron version up to 8.1.0
* [](feat) support default plugins in offline
* [](feat) update versions for plugins dependencies
* [](feat) basic plugins view
* [#643](feat) update bookmarks style
* [](feat) update typescript version
* [](feat) include default plugins into release package
* [](feat) exclude single-process plugin on fail
* [](refact) change alias "logviewer" to "chipmunk" (plugin's package.json)
* [](refact) remove depricated folder from repo
* [](feat) remove plugin's stuff from rakefile
* [](feat) remove plugins sources from repo
* [](feat) remove sandbox
* [](feat) change plugins init-workflow
* [#680](feat) get rid of predefined lists of plugins

### [1.40.1] - 03/10/2020
* [](fix) fail build if upload failed

### [1.40.0] - 03/09/2020

* [#673](fix) do not bail when fibex contains unsupported signal ids
* [#709](fix) added support for UTF-16 encoded content
  also simplified processor code

### [1.39.0] - 03/03/2020
* [#646](feat) update general styles
* [#695](feat) support exporting everything in DLT file
* [#687](feat) also: export sections from dlt file
* [#695](feat) support exporting everything in text files
  empty lines are no longer discarded so we can reproduce the input file
* [#695](feat) general support for saving text based files
* [#573](feat) support search based on text selection
* [](feat) remove source's name column from views
* [](fix) fix colors for DLT row render

### [1.38.1] - 02/17/2020

* [#563](feat) some corrections for saving dlt traces
  received over socket.
  * added API for sync reading dlt file
  * add API to save a DLT file created in a session
* [](fix) open any type of file on CMD-O/(Ctrl-O on windows/linux)
* [](feat) allow to save DLT stream on disconnect
* [](feat) PCAP files support (UI)

### [1.38.0] - 02/14/2020

* [](chore) set development env var for rake start
* [#563](feat) more standard conform parsing of dlt arguments
  * bool in particular was assuming either 0x0 or 0x1 but can in fact be
    a different uint8
  * accept reserved string encoding (also valid...we used to assume either
    UTF8 or ASCII)
* [](feat) Add new plugin as template (example plugin)
* [](fix) Show search results in chart view
* [](fix) Wait before shutdown while all logs will be written
* [](refact) Change close app workflow
* [#397](feat) pcap API integration
* [](feat) Ranked output for stats info in search
* [](feat) Close autocompete popup on toggle of toolbar
* [](fix) Correct dlt details view styles
* [](feat) Add context menu on view's tabs
* [#397](feat): basic pcap support
  * reading dlt files from pcap files
  * working future stream for socket
  * better error handling
* rust: Added global logging configuration in log4rs.yaml file
  * users can adopt the log level at runtime
* [](fix) Stability: Prevent search with incorrect ranges
* [](fix) Stability: Prevent search without filters
* [](feat) Clean recent filters history; drop current filters file
* [](feat) Update search overview annotations (main view) when user
    changes the style of a filter
* [](feat) Added autosaving of filters
* [](feat) Support loading/saveing filters form/to file
* [](feat) Upgrade search input area
* [](fix) Fix bug with asynch operationn in scope of search

### [1.37.0] - 01/27/2020

* [#655](feat) support fibex file for DLT-connector
* [#638](feat) support multiple fibex files
* [#638](feat) support DLT file reopening
* [#638](feat) support injections to title of tab (session's scope)
* [#658](feat) added support for multiple fibex configuration files

### [1.36.0] - 01/17/2020

#### support for DLT streaming over multicast

* [#562](feat) support live streaming of DLT messages via UDP
* [](feat) recent options for DLT connector
* [](feat) DLT UDP connector UI
* [](feat) DLT: correct display of fixed point values
* [](feat) serializing of dlt messages
      move tests to seperate file
      improved types of dlt entities
* [#644](refact) upgrade DLT options UI
* [](fix) fix validation issues (DLT connector)
* [#562](fix) added missing storage header
* [562](fix) mapping was corrupted when reconnecting

#### Extension API changes

* [](feat) support of plugins meta-data
* [](fix) some fixes for mac builds
* [#632](fix) remove recent popup, fix iostate bug
* [](fix) Fixed issue with iostate
* [](feat) plugin's settings API: support of droping; deep copy of objects
* [](fix) better naming for config API
* [](feat) Notifications API (client)
* [](feat) support settings of plugins

## Serial Port Plugin

* [](feat) Double click to connect to port
* [](feat) Popup window for recently used ports
* [#613](feat) Implement sparklines for open-port
* [] (feat) Newly connected port as default to send
* [](refact) Add notifications to serial service
* [](refact) Change Sparkline looks
* [](refact) Put available ports in component
* [](fix) Stop spy when popup window close
* [#337] (fix) Timeout and send char by char
* [](fix) Solve stopSpy issue
* [] (fix) Memorize port in ddlist

#### Charts

* [#606](feat) delivery updates of chart's data
* [#606](feat) append operation for charts
* [](fix) Fix empty chart update, patchy config file

#### Other changes

* [](feat) improved and more documentation
* [#526](feat) upgrade stream's tasks monitor
* [](feat)(refact) empty message creates new line
* [](feat) change progressbar on load
* [#592](feat) update recent files/filters view
* [](feat) sign binaries of plugins (mac)
* [](feat) do not lock sessions because plugins error
* [](feat) xterminal alive
* [](refact) move testcase to test file
* [](refact) update tabs style
* [](fix) fix search update state (search bar)
* [](fix) fix global style reset issue
* [](fix) fix issue with updating stream status (search bar)
* [](fix) fix notification wrong session issue
* [](fix) small fixes for search input and autocomplete
* [](fix) fix focus issue (search input)
* [](fix) fixing hotkey for search
* [](fix) Close all sessions issue fix

### [1.34.0] - 12/13/2019
* [#553](fix) remove debug stuff
* [#553](feat) upgrade DLT render plugin
* [#553](feat) update client API
* [#553](feat) chipmunk.client.toolkit -> 0.0.76
* [#551](feat) new logic of opening file (recent, dropping)
* [#574](fix) fixing hotkeys (mac)
* [#588](fix) fix movement across bookmarks
* [#564](feat) open dlt-stats on load
* [](fix) fix issue with options of chart
* [](fix) fix "remove all" chart issue
* [#586](feat) including angular/material

### [1.33.2] - 12/10/2019
* [](fix) correct "jumping" position from chart
* [#555](feat) highlighting current line (row)
* [#570](feat) remove dlt connector (JS implementation)
* [](fix) choke on dlt stats for invalid file
* [](fix) fix DLT row render (case of an incorrect income data)
* [](feat) addes dlt documentation

### [1.33.1] - 12/09/2019
* [](feat) more documentation
* [](feat) correct sorting files in recent dialogs
* [#523](feat) quick way to set filter as an active
* [#523](fix) fix scale for charts

### [1.33.0] - 12/09/2019
* [](feat): added some documentation
* [](fix) enable running integration tests with electron based node version
* [#523](feat) muliple axes for charts (to have diffrent scale)
* [#523](feat) mixing options of chart (different types)
* [#523](feat) highlight chart matches
* [#523](feat) convert charts to filters and filters to charts
* [#523](fix) charts list: exit edit mode on esc and outside-click
* [#523](feat) update search input logic
* [#523](fix) fix slider element (resize)
* [#523](feat) redirect from chart
* [#523](feat) redirection from chart
* [#523](feat) correct options view; prevent invalid chart request
* [#523](feat) support of float type
* [#523](feat) update chart options view on change type of chart
* [#523](feat) auto open charts tab; fix for cursor
* [#523](refact) update filters/charts manager
* [#558](feat) chart's options
* [#558](feat) support of diffrent types of charts
* [#523](feat) support of charts (common functionlity)
* [](feat) drop search input on storing
* [#554](fix) correct statistic on search
* [#523](feat) multiple charts support
* [#523](feat) UI for charts
* [#523](feat) charts proto-support
* [#523](feat) update views
* [#523](feat) communication, processing
* [#561, #565, #572](feat) better dlt log message representation
  also add information about if a file contained non-verbose
  log messages
* [](fix) remove logs
* [](fix) using electron as node to start tests

### [1.32.0] - 11/29/2019
* [](fix) do not exit process on neon side
  in certain error conditions we did exit the process which causes
  the chipmunk app to crash.
* wip
* [](feat) plugin developer docs (draft)
* [](feat) JSDocs for node lib IPC plugins
* [](feat) update toolkit JS docs
* [](doc) rest documentation for client.toolkit
* [](docs) description of client.toolkit API
* [](feat) convert test
* [](fix) fix interface references
* [](feat) remove unused references
* [](feat) get rid of timeout in scope of indexer
* [](fix) fix error on notification without sessions
* [](feat) move rest IPC messages into common folder
* [](feat) create common point for intefaces
* [](feat) cancellation for indexing, merge
* [](feat) indexer-neon: DLT cancel
* [](feat) cancel indexer-neon processing
* [](feat) cancel funnction for indexer-neon
* [](feat) provide a fibex file path to indexer-neon
* [](feat) UI to refer fibex file with DLT file
* [](fix) correct cancel options request (open file operation)
* [](feat) change exec path detection for darwin
* [](fix) do not kill process when error occured in parsing
* [](fix): fixed infinit parsing
  when parsing invalid dlt files we could get stuck
  exclude non running updater unit test
  added tests for cancellation of async dlt processing
* [](chor) do not fail on notarization step in non-production environments
  add integration test for dlt indexing cancellation

### [1.31.1] - 11/25/2019
* [](fix) use faster channel implementation for rust
* [](refactor) dlt non-verbose integration
  rust fmt
  some dlt format refactorings
  updated tests
* Fix optional PDU short-name handling
* Add fibex support for nonverbose DLT mode

### [1.31.0] - 11/22/2019
* [](fix) fixed path problem for windows build
* [](fix) fix rakefile for windows
* [](fix): only sign and notarize mac app if in correct environment
  * enable notarization
  * added checks for signature and notatization

### [1.30.2] - 11/21/2019
* [#545](fix) sign packaged application correctly on mac

### [1.30.0] - 11/19/2019



### [1.29.1] - 11/19/2019
* [](chore): take care of notarizing and signing
* [](fix): no need for .env reader for mac builds
  * rake: only copy whats needed for neon-indexer
  * support for notarizing and signing

### [1.29.0] - 11/18/2019
* [#464](feat) port rest of chipmunk functionality to neon interface
  * prepare merger api for streaming
  * add neon based async merger function
  * support of async merging
  * timestamp discovery over neon interface
  * no lvin anymore -- remove indexer_cli from build
* [](feat) add env into actions file

### [1.28.0] - 11/15/2019
* [](feat) ignore package-lock.json for toolkit
* [](feat) update package-lock.json
* [](feat) update rakefile (electron upgrade)
* [](feat) upgrade serialport lib (to 8.0.3)
* [](feat) electron upgrade

### [1.27.1] - 11/15/2019
* [](feat) mac build settings
* [](refactor): remove commented code

### [1.27.0] - 11/13/2019
* [#464](feat) remodel neon integration, add concatenation support
  * add option to get notifications from indexing/parsing
  * add indexer error reporting
  * tests running and usecases seem to work
  * convert timespan operation results to stream semantics
  * support for async discover timespan action (neon binding);
  * support for async file concatenation
  * updated package-lock files
  * lvin removed from concatenation
  * integration of neon based file concatenation
* [#539](fix) try to not choke on bad DLT messages
  * less verbose error messages for dlt
  * add support for unknown control types
* [](fix): improve build system: try to only build
  things that need building. for developers executing
  the `rake dev` task should be enough for all usecases.
  only build client libs when neccessary
* [](feat) Notifications service (electron -> render)
* [](feat) quick_release for developing (task for rake file "dev:quick_release")
* [#533](fix) fix plugin's sessions events hub
* [](fix) fix secondary area resize event fire
* [](feat) extendInfo settings for mac
* [](feat) redirection on marker's bar click
* [](fix) fix bookmark's navigation
* [](feat) client.toolkit verssion up -> 0.0.72

### [1.26.1] - 11/06/2019
* [](chore) run workflow also on tag

### [1.26.0] - 11/06/2019
* [](fix} fix paths in chipmunk.plugin.ipc lib
* [](fix) remove package-lock.json from plugins (backend)
* [](fix) fix dlt TS declaration
* [](fix) chipmunk.shell.env package fix
* [](fix) update package.json and package-lock.json files
* [](fix) fixing tslint errors
* [#531](fix) correct canceling search
* [#531](fix) correct closing search task on closing session
* [](fix) fix search performance issue (blocking UI)
* [](feat) frop focus from search manager of focus of active input
* [](fix) fix restoring of state on search view (switching tabs/sessions)
* [#400](feat) summary in search input
* [](feat) relocate state search status-bar-app
* [](fix) fix save button in filter's manager
* [#502](fix) fix recent filter dialog
* [#496](fix) avoid HTML tags
* [#502](feat) recent filters: filter + styles
* [#502](feat) auto focus
* [#502](feat) recent files: filer + styles
* [#502](feat) check recent file before list
* [#515](feat) support redirections from main -> search
* [#515](feat) bookmark navigation in main view
* [](fix) define rule for tslint (array declaration)
* [#400](fix) fix circle references issue
* [#400](feat) add search status bar-app
* [#485](feat) select text in search-input on focus
* [#528](feat) reset selected filter on active search
* [#527](fix) saving filters
* [](fix) fix hotkey rebinding on unfocused app
* [](fix) correct circle spinner colors
* [#512](fix) ignore JSON error and replace settings with defaults
* [#478](fix) added blocking write operation after controller was destroyed
* [#411](refact) update references in plugins; update versions
* [#411](refact) update build scripts
* [#411](refact) add patch "before" to rename existing home fodler
* [#411](refact) rename node.lib libraries
* [](feat) delivery plugin API (render) into plugin's service
* [](refact) refactoring electron part code; changing stream mapping logic
* ()[feat] update delay logic on postman (IPC to FE)
* [](fix): do not try to install typscript if it is present already
* ()[fix] fixing notification delay logic
* [](fix) add support for cancellation of neon indexer requests
  use cancellable api for neon indexer functions
  also switch registry to npm registry
* [](fix) fixed lint warnings
* [](chore) trigger build & deploy actions only on master
  trigger linting & building on pull-requests
* [#464](feat): integrate dlt indexing as neon based service
  * we need the event emitter for all the async communication via neon
    thus it needs to be a little more general.
    also: results for longrunning async operations will now be always
    streamed.
  * progress reporting and passing chunks from rust to js
  * detect duplicate files rake task
* [](chore) keep vs code workspace settings for indexer-neon under git control
  workspace settings for native neon part
* ()[feat] update plugins factory dependencies
* ()[feat] update plugins API (client.toolkit)
* ()[feat] update FE code to fit angular 8 and charjs updating
* ()[feat] update ts settings to fit angular 8
* ()[feat] upgrade version of angular and other libs on FE
* [](feat) upgrade webpack (client.toolkit)
* [] (fix) resolving plugins components on popup service
* [] (feat) added developer's tasks
* [](refact) rename client libs; update client.toolkit API
* [](fix) fix paths issue after IPC migration
* [](feat) move IPC to root level; update references to IPC; update rakefile
* [](feat) support zooming in main char's view
* [#511][fix] using tag marker instead line marker
* [github-xx][refact] change color of circle-spinner
* [#511][fix] correct search regexp
* [github-xx][fix] update no-tab screen
* [#511][fix] fix regular expression wrapper
* [github-xx][clean] remove unused modules
* [#400][feat] progress for all search steps
* [#400][feat] new kind of spinner (circle)
* [#400][feat] support of states via sessions
* [#505][#506][fix][feat] update chart UI

### [1.25.0] - 10/22/2019
* [](chore) added rake task to swich to local npm registry
  update npm packages
* [](fix) use correct neon version for build
* [](chore) cache ripgrep executable to avoid download during local build
* [](chore) node local ng exec
* [](chore) get rid of metadatafiles in git
* [](chore) check in package-lock.json files
* [](chore) tie down neon cli version
* [](chore) get rid of lint warnings
* [](chore) added workflow for linting
  * deleted stuff that should not be checked in
  * ignore metadata files
  * add package-lock files to git
* [](chore) gh actions for linting
* [](chore) removed unused files
  deleted unused rust code
* [](refactor) rake task for linting
* [](chore) corrected tslint errors
  removed rust warning

### [1.24.0] - 10/18/2019
* [#464](feat) add support to neon integration for dlt
  neon: wip on typescript side
  add support for progress reporting in dlt
  more general rust channels for js
  working tests for dlt indexing
* [](chore) trigger gh action to build also on pull-request

### [1.23.0] - 10/18/2019
* [](chore): extracted common rake functionality to rake-extensions
  improved raketask for linting
* [](chore): try to reduce windows build times for gh actions
  use gem rake-extensions
* [](chore): adapt badge for gh actions build
* [#199][feat] no glass on selection and reverse wheel
* [#199][feat] support small stream
* [#199][fix] fix scale issue
* [#199][fix] fix scale issue
* [github-xx][feat] remove research folder
* [#199][feat] shadow color on zoom panel of chart view
* [github-xx][feat] electron up to 6.0.12 (rakefile)
* [#199][feat] context menu on chart
* [github-xx][feat] xterm version upgrade
* [github-xx][feat] electron up to 6.0.12
* [github-xx][feat] upgrade angular injector usage way
* [github-xx][fix] client.core: resolve ng-lint errors/warnings
* [#199][feat] charts: wheel support
* [#199][feat] store chart state
* [#199][fix] search view: save state on switch tab
* [#199][feat] default color for bars (active search)
* [#199][fix] correct saving of states in scope of session
* [#199][feat] correct color for bars in chart
* [#199][feat] fix scale on movement
* [#199][feat] update controllers
* [#199][feat] chart dialogs (template)
* [#199][feat] chartjs
* [#199][fix] correct search
* [#199][feat] chart sidebar (template)
* [#199][feat] chart main view (secondary area)
* [#199][feat] update search terms
* [#199][feat] dynamic adding sidebar tabs
* [github-xx][fix] correct activation tab on removing (in case empty history)
* [github-xx][feat] correct handeling closing of session
* [github-xx][refact] move notifications view into correct place
* [github-xx][feat] support dynamic adding sidebar apps
* [github-xx][fix] fix size of injection area (tab's list component)
* [github-xx][fix] fix injections layout for vert tabs aligned
* [github-xx][feat] plugins versions up (because electron upgrade)

### [1.22.1] - 10/14/2019
* [#497](fix): require missing ruby library in rakefile
  downloading files did not work anymore

### [1.22.0] - 10/14/2019
* [](chore): add versioning rake task
  * extract additional rake functionality in it's own file
  * create nicer changelogs
* [#71](chore): workflows with github actions
  rake tasks for linting and creating tagged releases
  fix move of final delivery to folder
  remove unused files when deploying
  fix build for windows
  install missing dependencies for neon build
  make sure correct python version is installed on windows
  vs 2015 install for windows since the default hangs
  rake task to prepare neon builds with cargo config on windows
  remove unused file
  rake task polish
* [](fix): fix rakefile for windows
* [#493](feat) support ticks format
* [](chore): do not execute rake task if an exception happened
* [](chore): refactor rake tasks to build plugins only when necessary"
* [github-xx][fix] correct progress counting (open files)
* [](chore): js library updates
* [](chore) add neon libs to clobber task
  added developer rake task
* [#482](feat) progress reporting in neon lib
  progress for neon task, added js interface
* [github-xx][fix] clean code
* [github-298][feat] version up of toolkit
* [github-xx][fix] fix state controller
* [github-298][feat] update services to fit IPC changes
* [github-298][feat] update toolkit lib
* [github-298][feat] updated standard css
* [github-298][fix] fix standart input
* [github-298][feat] update layout (in scope of sidebar)
* [github-298][refact] added sidebar service
* [github-298][feat] added overwrite method into filters holder
* [github-298][feat] update search view component
* [github-298][feat] update item component (filters tab)
* [github-298][feat] update details component (filters)
* [github-298][feat] controlls panel for filters tab
* [github-298][feat] update filter component
* [github-xx][feat] update recent files dialog
* [github-298][feat] recent fiters dialog
* [github-298][feat] IPC update (render <-> electron)
* [github-xx][fix] reset winhook (for neon) to original
* [github-xx][fix] fix rakefile for windows
* [github-xx][feat] rollback filters service to prev version
* [github-xx][feat] indexer: electron version up to 6
* [github-xx][feat] up to electron 6
* [](chore): add linker function for neon build on linux
* [](chore): add conditional delayed start hook so neon
  so neon works on windows also
  * do not use global neon installation
  * added clean task to npm script
  * added pre-install step for windows to enable delayed electron startup
  * neon integration for linux (fix missing linked symbols
* [](chore): add conditional delayed start hook so neon
  so neon works on windows also
  * do not use global neon installation
  * added clean task to npm script
* [#464](feat): first test for using the newly created neon library for indexing
* [](chore): small updates (neon artifacts, version update of process)
* [](refactor): improve rake task structure
  * added benchmarks
  * better task structure
  * better dependency management for improved performance
  * add neon cli for travis build
* [#464](feat): indexer integration via neon
  * basic event mechanism setup for neon integration
  * add argument to index API for TAG
* [#464](feat) implement progress support and cancel support for indexing
  indexer needs to be able to deliver events in channel
  enable shutdown and progress report
  use log crate for logging
  increase version of indexer cli
