[![](https://github.com/esrlabs/chipmunk/workflows/FullBuild/badge.svg)](https://github.com/esrlabs/chipmunk/actions)

# Chipmunk Log Analyzer & Viewer

`chipmunk` is a fast logfile viewer that can deal with huge logfiles (>10 GB). It powers a super
fast search and is supposed to be a useful tool for developers who have to analyze logfiles.

## basic searching & highlighting

`chipmunk`'s search is powerd by rust and is super fast even for gigabytes of logs.

![](https://raw.githubusercontent.com/esrlabs/chipmunk/master/docs/assets/search-highlights.png)

Of course multiple searches are supported and filters can be saved and restored.

![](https://raw.githubusercontent.com/esrlabs/chipmunk/master/docs/assets/multiple-filters.png)

## Bookmarks

Bookmarks can be used to pin down log entries that are important to the user.

![](https://raw.githubusercontent.com/esrlabs/chipmunk/master/docs/assets/bookmarks.png)

## DLT support

The Diagnostic Log and Trace AUTOSAR format is widely used in the automotive industry and is a
binary log format. `chipmunk` can understand and process DLT content in large quantities.

![](https://raw.githubusercontent.com/esrlabs/chipmunk/master/docs/assets/dlt-support.png)

## Combining multiple files

To help developers to deal with multiple logfiles, chipmunk can automatically detect timestamps and
merge logs from multiple files.

![](https://raw.githubusercontent.com/esrlabs/chipmunk/master/docs/assets/merging-timestamp-detection.png)

Of course simple concatenating files is also a supported usecase. Just drag & drop multiple files
and select your operation:

![](https://raw.githubusercontent.com/esrlabs/chipmunk/master/docs/assets/merge-or-concat.png)

After that, the files are combined.

![](https://raw.githubusercontent.com/esrlabs/chipmunk/master/docs/assets/merge-result.png)

## Keyboard Shortcuts

Important to most developers: a good and intuitive set of keyboard shortcuts.

![](https://raw.githubusercontent.com/esrlabs/chipmunk/master/docs/assets/shortcuts.png)
