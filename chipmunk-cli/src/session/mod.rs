pub mod file;
pub mod socket;

//TODO AAZ: Temp solution to avoid changing code in chipmunk.
// Separators values used in indexer in Chipmunk.
const CHIPMUNK_DLT_COLUMN_SENTINAL: char = '\u{0004}';
const CHIPMUNK_DLT_ARGUMENT_SENTINAL: char = '\u{0005}';

// Separators to be used here in the CLI tool.
const CLI_OUT_MAIN_SEPARATOR: &str = " ||| ";
const CLI_OUT_ARG_SEPARATOR: &str = " &&& ";

const ERROR_MSG: &str = "Error while writing parsed message to buffer";
