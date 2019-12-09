# User Guide

This guide describes the most common usecases for using chipmunk.

## [Searching and Filtering](searching_and_filtering.md)

<img src="assets/magnifying-search-lenses-tool.png" width="100" height="100">

Searching through huge logfiles

## [Concatenating logfiles](concatenation.md)

<img src="assets/glue_together.png" width="100" height="100">

`chipmunk` can combine multiple log file. This is useful for example
when you just want to reassamble a logfile that were stored in parts.

## [merging](merging.md)

![](assets/intersection.png)

Merging is useful if you have several log files e.g. from different
devices/processors and you want combine them by merging according to their
timestamps.

## [Charts](charts.md)

![](assets/chart.png)

To better understand what's going on in a large logfile, it can be helpful to visualize data over
time. `chipmunk` let's you define regular expressions that match a number and to use this expression
to capture a value throughout a logfile.

## [Bookmarks](bookmarks.md)

<img src="assets/bookmark_sign.png" width="100" height="100">

Add bookmarks to mark and remember important log entries. Jump between bookmarks with shortcuts (`j` and `k`).

## [DLT - Diagnostic Log and Trace](dlt.md)

<img src="assets/dlt.png" width="200" height="200">

View and search and filter DLT files.