#[cfg(test)]
mod tests {
    use crate::fibex::read_fibexes;
    use std::path::PathBuf;
    #[test]
    fn test_fibex_parsing() {
        let fibex = read_fibexes(vec![
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/dlt-messages.xml")
        ])
        .expect("can't parse fibex");
        println!("{:?}", fibex);
    }
}
