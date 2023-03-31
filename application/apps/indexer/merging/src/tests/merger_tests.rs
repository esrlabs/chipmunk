#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use crate::merger::*;
    use crossbeam_channel as cc;
    use indexer_base::{
        chunks::ChunkResults,
        progress::{IndexingProgress, Notification},
    };
    use pretty_assertions::assert_eq;
    use std::{fs, path::PathBuf};
    use tempdir::TempDir;
    extern crate log;

    use log::LevelFilter;
    use log4rs::{
        append::console::ConsoleAppender,
        config::{Appender, Config, Root},
    };
    use std::sync::Once;

    static INIT: Once = Once::new();

    fn init_logging() {
        INIT.call_once(|| {
            let stdout = ConsoleAppender::builder().build();
            let config = Config::builder()
                .appender(Appender::builder().build("stdout", Box::new(stdout)))
                .build(Root::builder().appender("stdout").build(LevelFilter::Trace))
                .unwrap();

            match log4rs::init_config(config) {
                Ok(_) => (),
                Err(e) => println!("error initalizing logger: {e:?}"),
            }
        });
    }

    #[test]
    fn test_merge_inputs_with_writer() {
        assert_eq!(true, true)
    }

    // TODO test files with lines without timestamp
}
