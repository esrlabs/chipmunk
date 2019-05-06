# logviewer indexer

Create index file and mapping file for logviewer

```
USAGE:
    logviewer_parser [FLAGS] [OPTIONS] <file> <source>

FLAGS:
    -h, --help         Prints help information
    -V, --version      Prints version information
    -v, --verbosity    Pass many times for more log output

OPTIONS:
    -s, --chunk_size <chunk_size>    How many lines should be in a chunk (used for access later) [default: 500]
    -n, --max_lines <max_lines>      How many lines to collect before dumping [default: 1000000]

ARGS:
    <file>      The file to read
    <source>    how to tag the source
```

# Changelog

0.4.2 (5/6/2019):
  * correctly handle CRLF at start of line

0.4.1 (5/6/2019):
  * remove verbose output

0.4.0 (5/6/2019):
  * append to mapping file supported

0.3.0 (5/6/2019):
  * fix bug in mapping file
  * rename mapping file to [infile_name].mapping.json
