#[path = "./proto.rs"]
mod proto;

#[cfg(test)]
mod tests {
    use super::proto::{MAX_PACKET_LEN, Parser, Source};
    use bufread::BufReader;

    const SOURCE_MIN_SIZE: usize = 10 * MAX_PACKET_LEN;
    const BUFFER_MAX_SIZE: usize = 3 * MAX_PACKET_LEN;
    const BUFFER_MIN_SIZE: usize = MAX_PACKET_LEN;

    #[test]
    fn test_fixed_source() {
        let source = Source::fixed(SOURCE_MIN_SIZE);
        let reader = BufReader::new(BUFFER_MAX_SIZE, BUFFER_MIN_SIZE, source.data());
        let mut parser = Parser::new(reader);

        match Parser::run(&mut parser) {
            Ok(result) => {
                assert_eq!(source.num_packets(), result.0);
                assert_eq!(source.data_len(), result.1);
            }
            Err(error) => {
                panic!("{}", error);
            }
        }
    }

    #[test]
    fn test_random_source() {
        let source = Source::random(SOURCE_MIN_SIZE);
        let reader = BufReader::new(BUFFER_MAX_SIZE, BUFFER_MIN_SIZE, source.data());
        let mut parser = Parser::new(reader);

        match Parser::run(&mut parser) {
            Ok(result) => {
                assert_eq!(source.num_packets(), result.0);
                assert_eq!(source.data_len(), result.1);
            }
            Err(error) => {
                panic!("{}", error);
            }
        }
    }
}
