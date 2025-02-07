// Copyright (c) 2025 ESR Labs GmbH. All rights reserved.
//
// NOTICE:  All information contained herein is, and remains
// the property of E.S.R.Labs and its suppliers, if any.
// The intellectual and technical concepts contained herein are
// proprietary to E.S.R.Labs and its suppliers and may be covered
// by German and Foreign Patents, patents in process, and are protected
// by trade secret or copyright law.
// Dissemination of this information or reproduction of this material
// is strictly forbidden unless prior written permission is obtained
// from E.S.R.Labs.

#[path = "./proto.rs"]
mod proto;

#[cfg(test)]
mod tests {
    use super::proto::{Parser, Source, MAX_PACKET_LEN};
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
