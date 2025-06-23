# Protobuf Message Stream Parser

This parser is designed for extracting Protocol Buffers (protobuf) messages from a data stream.

## Prerequisites

A protobuf descriptor file is required for decoding messages. The descriptor file can be generated using the following command:

```sh
protoc --include_imports --descriptor_set_out=output.bin input.proto
```

## Features

- Assumes that the received data packet corresponds to a single protobuf message.
- Not suitable for reading binary files that store multiple unframed messages.
- Can be used for processing TCP/UDP streams where each frame corresponds to a single protobuf message.
- Suitable for analyzing network traces (e.g., PCAP or PCAPNG files).

## Testing

For testing the parser, a Python script (`test/tcp_server.py`) is provided. This script creates a TCP server that sends a sequence of bytes, including both valid and invalid protobuf messages, simulating a real-world stream scenario.

