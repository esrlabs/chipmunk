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


## Fetching and Processing

The producer exposes its work in two halves, and the split is a contract rather than a convenience:

- `fetch()` is **async** and does nothing but ask the `ByteSource` for more bytes. It is the only awaiting step of the producer and it is **cancel safe**, as long as the `ByteSource::load()` implementation is (the trait requires it). Dropping the future loses no data: everything loaded already lives in the source's internal buffer. This is the method that belongs on a `select!` arm.
- `process()` is **synchronous**. It parses the bytes the source currently holds, appends the produced items to the given `LogRecordsCollector` and resyncs by dropping bytes when the parser can't make sense of them. It is deliberately not `async` so it *cannot* be cancelled halfway through: never call it inside a `select!` arm, call it on the result of `fetch()`, outside the macro.

`process()` takes the `FetchInfo` returned by the preceding `fetch()` call by value. `FetchInfo` has no public constructor and is neither `Clone` nor `Copy`, so the only way to obtain one is to call `fetch()`, and passing it into `process()` consumes it: calling `fetch()`-then-`process()` in that order, once per fetch, is a fact the compiler checks rather than a convention documented on the two methods.

`process()` never loads. When the parser needs more bytes it returns `ProcessOutcome::NeedMoreBytes`, and the caller has to run `fetch()` again to obtain a fresh `FetchInfo` before calling `process()` again. The other outcomes are `Parsed` (items were appended), `NoData` (the source is dry right now — the caller decides whether that means tailing or stopping) and `Done` (the parser reached the end of the data; the producer stays finished).

`produce_next()` is a convenience wrapper that loops over both steps for callers which don't need to interleave other work between them, such as the exporters and the CLI. It is cancel safe by construction, since its only await points are `fetch()` calls.

The session's processing loop in `crates/core/session/src/handlers/observing/mod.rs` uses the two-step form: `fetch()` races the flush deadline, the SDE receiver and the cancellation token inside the `select!`, and `process()` runs on the result outside of it.
