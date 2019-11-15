# Changelog

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
