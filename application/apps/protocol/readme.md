# Components
- rustcore
- rs-binding
- ts-binding
- holder (Electron)
- client (HTML front-end)

# Communication

- `rustcore` <-> `rs-binding`: direct calls (Rust context)
- `rs-binding` <-> `ts-binding`: protobuf messages
- `ts-binding` <-> `holder`: direct calls (NodeJS context)
- `electron` <-> `client`: IPC messages (JS objects)

# Issues and the "Vulnerability" of JSON Format

`rustcore` exchanges complex objects with deeply nested fields. When working at the `rs-binding` level, passing and receiving these objects "as is" requires converting them between `Rust` and `JS`. This not only complicates the code but may also impact performance. Previously, to avoid this conversion overhead, all objects were transformed into `JSON` strings. However, using the `JSON` format can lead to unpredictable results, especially when handling data without a predefined encoding (e.g., invalid UTF-8 characters). Additionally, parsing a `JSON` string in `JS` and `Rust` may yield inconsistent results.

A potential solution to this problem is to transmit bytes instead of strings and implement a predictable mechanism for encoding and decoding messages from bytes. `Protobuf` was chosen as a candidate protocol due to its ability to define schemas (message lists) and generate encoding/decoding code for both `JS` and `Rust`.

# Uncertainty of `protobuf` in Different Contexts

A feature of `protobuf` is that the handling of boundary values for fields in a message is determined by the platform implementing the protocol. For example, in `Rust`, all primitive types have default values, such as `u8` defaulting to `0`. Thus, for a message like `Msg { field: u8 }` or `Msg { field: Option<u8> }`, the following two messages in Rust:

- `Msg { field: 0 }`
- `Msg { field: None }`

can be encoded without explicitly defining the `field` value. In the first case, the default value is used, while in the second, the field is undefined. Conversely, in the `JS` implementation, the message `Msg { field: 0 }` will always encode the `field` with the value `0`, as `JS` lacks the concept of default values.

As a result, a message like `Msg { field: 0 }` encoded in `JS` will consume more bytes than the same message encoded in `Rust`, making it impossible to decode the `Rust`-encoded message in `JS`.

## Solution Approaches

One way to address this problem is to define a stricter protocol schema and configure the code generator accordingly. However, this solution is not robust in the long term since schema settings or generator behavior may change. Additionally, stricter schema requirements increase maintenance complexity and hinder code extensibility.

An alternative approach is to use a single `protobuf` implementation for both `Rust` and `JS`. We can achieve this by encapsulating the generated `protobuf` code in a trait and wrapping it in `wasm`, enabling its usage in `JS` without cross-platform compatibility issues. On the `Rust` side, we can use the crate directly.

The only remaining issue is that all messages on the `JS` side remain untyped, meaning all received objects are essentially of type `any` and require additional validation. This issue is partially addressed by the external crate `tslink`, which works alongside `protobuf` code generation to analyze generated `structs` and `enums` and produce `*.ts` files with TypeScript `interfaces` and `enums`. This approach ties messages to expected types and allows compile-time checks for message format changes that require code updates. While runtime validation existed in the previous `JSON`-based solution, this approach eliminates runtime-only errors and prevents bugs from reaching production releases.

# Solution

## Code Structure

The following additions were made:

```
application
    apps
        protocol
            extend/     # Macro for wrapping Rust code in wasm
            proto/      # Crate with generated protobuf code
            scheme/     # Protobuf schema
            wasm/       # Wrapped protocol code for NodeJS
            gen.sh      # Script to generate protobuf code
            readme.md
```

## Interaction Scheme

The `proto` crate is used directly in `rs-binding` for:

1. Converting `rustcore` types to `protobuf` messages and vice versa.
2. Decoding incoming bytes from `ts-binding` to `protobuf` messages and then back to `rustcore` types.

This process for communication between `rs-binding` and `ts-binding` is as follows:

```
ts-binding: TS Entity ==> ProtoBuf Msg ==> bytes 
rs-binding: bytes ==> ProtoBuf Msg ==> Rustcore Entity
```

It is evident that using `protobuf` under this architecture necessitates an intermediate conversion from bytes to `protobuf` messages and subsequently to "original" types. In contrast, with `serde`, original types were directly deserialized from bytes. This tradeoff is the price for adopting `protobuf`.

Notably, all conversion operations are confined to the `rs-binding` and `ts-binding` components. Other parts of the project remain agnostic to `protobuf`, operating with their native data types.

As mentioned earlier, alongside `protobuf` code generation, the `tslink` crate generates `*.ts` files describing `protobuf` messages in TypeScript terms. These files are placed in `application/apps/protocol/proto/output` and subsequently copied to `application/apps/rustcore/ts-bindings/src/protocol`. The `gen.sh` script automates this process.

## Generation Details

Since the message schema is stable, it does not require frequent regeneration for every release or code change (unless the `protobuf` schema itself changes). Furthermore, the generated code is platform-independent, eliminating the need for separate generation per platform. Thus, incorporating `protobuf` generation into the build system is unnecessary. A simple script (`application/apps/protocol/gen.sh`) suffices for updating the code as needed.

# Conclusion

The main achievement in this task is leveraging `wasm` to improve not only performance but also stability. As discussed, `protobuf` implementations in `JS` and `Rust` are incompatible in certain "edge" cases. However, using `wasm` elegantly resolves this issue while enhancing performance.

Nonetheless, adopting `protobuf` introduces complexity due to the required conversion of `protobuf` messages into original types. Given that this communication is entirely internal (i.e., no external network messages necessitate strict adherence to a protocol), `protobuf` might be an over-engineered solution. A simpler alternative using `serde` + `bincode` (with `wasm` integration) could suffice.

Finally, during this task, a bug in `node-bindgen` was identified and resolved. The crate lacked safe mechanisms for sending/receiving bytes, which has now been addressed.
