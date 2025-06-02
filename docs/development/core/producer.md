# Message Producer

The `MessageProducer` struct serves as a key component within the Chipmunk core, responsible for orchestrating the data ingestion pipeline. Its primary role is to connect a source providing raw bytes (implementing the `ByteSource` trait) with a mechanism for interpreting those bytes (implementing the `Parser` trait), managing the entire cycle from polling data to parsing it and delivering the results for further processing within Chipmunk.

The `MessageProducer` is designed to be generic over different implementations of the `ByteSource` and `Parser` traits, allowing for flexible combinations of data sources and parsing formats based on specific session requirements.

Implementations for `ByteSource` and `Parser` can be either **built-in** components provided by the Chipmunk core or provided dynamically via the **plugin system** based on WebAssembly and the Component Model.

Chipmunk currently includes the following built-in parsers:

- DLT
- SomeIP
- StringTokenizer

And a variety of built-in byte-sources:

- BinaryByteSource (For files with binary format)
- TCP
- UDP
- Process Commands
- PCapNG
- PCap Legacy

For a visual representation of how the Message Producer connects Byte Sources and Parsers, please refer to the [diagram](./producer-plugins.svg).

