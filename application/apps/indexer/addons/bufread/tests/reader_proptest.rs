#![allow(dead_code)]

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
    use proptest::prelude::*;
    use proptest::test_runner::FileFailurePersistence;

    proptest! {
        #![proptest_config(ProptestConfig::with_failure_persistence(FileFailurePersistence::Off))]
        #[test]
        fn reader_proptest(
            source_min_size in (MAX_PACKET_LEN / 2)..(3 * MAX_PACKET_LEN),
            buffer_max_size in MAX_PACKET_LEN..(2 * MAX_PACKET_LEN)
        ) {
            let buffer_min_size = MAX_PACKET_LEN;

            let source = Source::fixed(source_min_size);
            let reader = BufReader::new(buffer_max_size, buffer_min_size, source.data());
            let mut parser = Parser::new(reader);

            match Parser::run(&mut parser) {
                Ok(result) => {
                    if source.num_packets() != result.0 {
                        panic!("num packets does not match: {} != {}", source.num_packets(), result.0);
                    }
                    if source.data_len() != result.1 {
                        panic!("source len does not match: {} != {}", source.data_len(), result.1);
                    }
                }
                Err(error) => {
                    panic!("{}", error);
                }
            }
        }
    }
}
