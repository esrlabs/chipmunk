#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use crate::fibex::read_fibex;
    #[test]
    fn test_fibex_parsing() {
        let fibex = read_fibex(&PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/dlt-messages.xml")).expect("can't parse fibex");
        println!("{:?}", fibex);
    }
}