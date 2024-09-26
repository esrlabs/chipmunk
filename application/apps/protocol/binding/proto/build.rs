use std::fs;
use std::path::PathBuf;

/// Path to sources of binding's protocols descriptions
const PROTO_SRC: &str = "../scheme";

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
    let binding = prost_build::Config::new();
    let mut cfg = binding;
    cfg.type_attribute(".", r#"#[derive(serde::Serialize, serde::Deserialize)]"#);
    for proto in protos.iter() {
        let file_name = proto
            .file_stem()
            .expect("Proto file has filename")
            .to_str()
            .expect("File name is valid UTF8");
        cfg.type_attribute(
            format!(".{file_name}"),
            format!(
                "#[tslink::tslink(target = \"./output/{file_name}.ts\", module = \"{file_name}\")]"
            ),
        );
    }
    cfg.compile_protos(&protos, &[PROTO_SRC])
        .expect("Fail to compile protos");
}
