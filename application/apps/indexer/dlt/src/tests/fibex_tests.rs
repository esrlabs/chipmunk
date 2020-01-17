#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use crate::fibex::read_fibexes;
    #[test]
    fn test_fibex_parsing() {
        let fibex =
            read_fibexes(&[&PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/dlt-messages.xml")])
                .expect("can't parse fibex");
        println!("{:?}", fibex);
    }
}
