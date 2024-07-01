use std::fs;
use std::path::PathBuf;

/// Path to sources of binding's protocols descriptions
const PROTO_SRC: &str = "../../../../src/binding";

fn main() {
    let protos: Vec<PathBuf> = fs::read_dir(PROTO_SRC)
        .unwrap_or_else(|_| panic!("Fail to read: {PROTO_SRC}"))
        .filter_map(|entry| {
            let path = entry
                .unwrap_or_else(|_| panic!("Fail to read element in: {PROTO_SRC}"))
                .path();
            if path.extension().and_then(|s| s.to_str()) == Some("proto") {
                Some(path)
            } else {
                None
            }
        })
        .collect();

    prost_build::compile_protos(&protos, &[PROTO_SRC]).expect("Fail to compile protos");
}
