/// The `definitions` crate describes the interfaces (traits) of the core system components:
/// - `Parser`: Responsible for interpreting incoming data.
/// - `Source`: Responsible for delivering data to the parser.
/// - `LogRecordOutput`: The result of parsing; represents the smallest unit of data in the system.
/// - `LogRecordWriter`: Responsible for writing data after processing; consumes `LogRecordOutput`.
mod parser;
mod record;
mod source;

pub use parser::*;
pub use record::*;
pub use source::*;
