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
