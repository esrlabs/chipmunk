# logviewer indexer

Create index file and mapping file for logviewer

```
USAGE:
    logviewer_parser [FLAGS] [SUBCOMMAND]

FLAGS:
    -h, --help       Prints help information
    -v               Sets the level of verbosity
    -V, --version    Prints version information

SUBCOMMANDS:
    format    test format string
    help      Prints this message or the help of the given subcommand(s)
    index     command for creating an index file
    merge     command for merging multiple log files
```

For indexing a log file use the `index` subcommand:

```
logviewer_parser-index
command for creating an index file

USAGE:
    logviewer_parser index [FLAGS] [OPTIONS] <input> --tag <TAG>

FLAGS:
    -a, --append     append to file if exists
    -h, --help       Prints help information
    -s, --stdout     put out chunk information on stdout
    -V, --version    Prints version information

OPTIONS:
    -c, --chunk_siz <chunk_size>    How many lines should be in a chunk (used for access later) [default: 500]
    -n, --max_lines <max_lines>     How many lines to collect before dumping [default: 1000000]
    -o, --out <OUT>                 Output file, "<file_to_index>.out" if not present
    -t, --tag <TAG>                 tag for each log entry

ARGS:
    <input>    Sets the input file to be indexed
```

For merging log-files use the `merge` subcommand:

```
logviewer_parser-merge
command for merging multiple log files

USAGE:
    logviewer_parser merge [FLAGS] [OPTIONS] <merge_config> --out <OUT>

FLAGS:
    -a, --append     append to file if exists
    -h, --help       Prints help information
    -s, --stdout     put out chunk information on stdout
    -V, --version    Prints version information

OPTIONS:
    -c, --chunk_siz <chunk_size>    How many lines should be in a chunk (used for access later) [default: 500]
    -n, --max_lines <max_lines>     How many lines to collect before dumping [default: 1000000]
    -o, --out <OUT>                 Output file

ARGS:
    <merge_config>    input file is a json file that defines all files to be merged
```

For testing a format string use the `format` subcommand:

```
logviewer_parser-format
test format string

USAGE:
    logviewer_parser format <format-string> <test-string>

FLAGS:
    -h, --help       Prints help information
    -V, --version    Prints version information

ARGS:
    <format-string>    format string to use
    <test-string>      test string to use
```

## Date Format for timestamps

When using the merge option, 2 or more files can be merged together into one indexed logfile. In order to know how the log entries
can be sorted correctly, we need to detect the timestamp for each entry.
It is possible to detect the used date format in certain cases, here is an example of what can be detected out-of-the-box:

Log entries that look like this `05-22 12:36:36.506 +0100 ...` will detect this format: `"MM-DD hh:mm:ss.s TZD"`
Log entries that look like this `05-22-2019 12:36:04.344 ...` will detect this format: `"MM-DD-YYYY hh:mm:ss.s"`

To support different formats, it is possible to define a custom date-time format using the following conventions:

```
YYYY = four-digit year
MM   = two-digit month (01=January, etc.)
DD   = two-digit day of month (01 through 31)
hh   = two digits of hour (00 through 23) (am/pm NOT allowed)
mm   = two digits of minute (00 through 59)
ss   = two digits of second (00 through 59)
s    = one or more digits representing a decimal fraction of a second
TZD  = time zone designator (Z or +hh:mm or -hh:mm)
```

These format specifiers are taken from the ISO 8601 and should cover most scenarios.
Examples include:

```
Year:
    YYYY (eg 1997)
Year and month:
    YYYY-MM (eg 1997-07)
Complete date:
    YYYY-MM-DD (eg 1997-07-16)
Complete date plus hours and minutes:
    YYYY-MM-DDThh:mmTZD (eg 1997-07-16T19:20+01:00)
Complete date plus hours, minutes and seconds:
    YYYY-MM-DDThh:mm:ssTZD (eg 1997-07-16T19:20:30+01:00)
Complete date plus hours, minutes, seconds and a decimal fraction of a second
    YYYY-MM-DDThh:mm:ss.sTZD (eg 1997-07-16T19:20:30.45+01:00)
```

To test it, you can use the logviwer_parser like this:

```
logviewer_parser -f "DD.MM.YYYY" -x "22.12.1972"
got format str: DD.MM.YYYY
got format example: 22.12.1972
match: Ok(true)
```


# Changelog

### [0.15.0] - 06/03/2019
  * implemented support to define date format string for parsing dates in
  * files to be merged
  * * basic proptype tests
  * * basic format parsing
  * * create regex by parsing date format
  * * handle more then 1 space
  * * use ISO 8601 like format specifiers
  * * add command line support to test date format

### [0.14.0] - 05/20/2019
  * [](feat): update indexed file as soon as we write chunks to stdout
  * playing with nom

### [0.13.0] - 05/20/2019
  * [](fix): append to empty file starts rows at 0 now
  * report mapping on the fly and not only at end

### [0.12.0] - 05/19/2019
  * play with other parsing mechanisms for merging
  * [](feat): timestamp in files to merge does not need to be at beginning

### [0.11.0] - 05/18/2019
  * [](feat): merging now done with constant memory
  * progress reports on merging

### [0.10.0] - 05/16/2019
  * better error handling
  * report mapping for merging to stdout

### [0.9.2] - 05/16/2019
  * [](refactor): using BufWriter to write to files
  * better than doing it by hand, perfomance looks the same
  * code is simpler
  * [](refactor): extracted creating the index file functionality

### [0.9.1] - 05/15/2019
  * [](fix): corrected timestamp parsing: day and month were mixed up

### [0.9.0] - 05/15/2019
  * feat: first support for merging
  * implemented regex discovery
    * line detection
  * rearranged test folders
    * get use temp-dir for all tests where we create files
  * first implementation of merge
  * add option to use config file for merging
  * improoved error handling
  * push functionality to util for reuse
  * add tags and line numbers to merged file
  * deal with missing timestamp for a line

### [0.8.2] - 05/13/2019
  * [](fix): fixed row offsets in mapping file
  * basic timestamp parsing works

### [0.8.1] - 05/13/2019
  * [](fix): add missing newlines to stdout mapping

### [0.8.0] - 05/13/2019
  * added option to spit out mapping info on stdout (use `-t` to get
    all chunks that have been written to stdout)
  * replace tests with example input output tests
  * more test cases in file form
  * started work on merging files by timestamp

### [0.7.1] - 05/11/2019
  * nicer progress reporting

### [0.7.0] - 05/10/2019
  * [](feat): print all chunks to stdout for progress tracking
  * [](chore): test case for utf8 invalid characters
  * porting test cases to example folders, testcases
  * based on file samples

### [0.6.0] - 05/09/2019
  * added rake task to create changelog for release
  * [](feat): improve performance for processing large files
  * now we use BufReader::read_until to avoid UTF-8 validity checks

### [0.5.0] - 5/7/2019
  * allow for text files that contain invalid UTF-8 characters without discarding illegal lines

### [0.4.6] - 5/7/2019
  * allow for text files that contain invalid UTF-8 characters

### [0.4.5] - 5/6/2019
  * fix row number starting row when appending (was wrong in json mapping)
  * allow for using append mode (`-a`) even if file does not exist

### [0.4.4] - 5/6/2019
  * handle empty index files

### [0.4.3] - 5/6/2019
  * handle empty files

### [0.4.2] - 5/6/2019
  * correctly handle CRLF at start of line

### [0.4.1] - 5/6/2019
  * remove verbose output

### [0.4.0] - 5/6/2019
  * append to mapping file supported

### [0.3.0] - 5/6/2019
  * fix bug in mapping file
  * rename mapping file to [infile_name].mapping.json
