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
                Err(e) => println!("error initalizing logger: {:?}", e),
            }
        });
    }

    #[test]
    fn test_merge_inputs_with_writer() {
        assert_eq!(true, true)
    }

    test_generator::test_expand_paths! { test_merge_files; "merging/test_samples/*" }

    fn test_merge_files(dir_name: &str) {
        init_logging();

        let tmp_dir = TempDir::new("test_dir").expect("could not create temp dir");
        let out_file_path = tmp_dir.path().join("tmpTestFile.txt.out");
        let option_path = PathBuf::from("..").join(&dir_name).join("config.json");
        let append_to_this = PathBuf::from("..").join(&dir_name).join("append_here.log");
        let append_use_case = append_to_this.exists();
        if append_use_case {
            fs::copy(&append_to_this, &out_file_path).expect("copy content failed");
            trace!("copied from {:?}", append_to_this);
            let content = fs::read_to_string(append_to_this).expect("could not read file");
            trace!("content was: {:?}", content);
            trace!("copied content to: {:?}", out_file_path);
            let content2 = fs::read_to_string(&out_file_path).expect("could not read file");
            trace!("copied content was: {:?}", content2);
        }

        let (tx, rx): (cc::Sender<ChunkResults>, cc::Receiver<ChunkResults>) = cc::unbounded();

        merge_files_use_config_file(&option_path, &out_file_path, append_use_case, 5, tx, None)
            .expect("calling our merge function should succeed");
        let mut last_processed_line: usize = 0;
        loop {
            match rx.recv() {
                Ok(Ok(IndexingProgress::Finished)) => {
                    trace!("finished...merged_lines_cnt: {:?}", last_processed_line);
                    let out_file_content_bytes =
                        fs::read(&out_file_path).expect("could not read file");
                    let out_file_content = String::from_utf8_lossy(&out_file_content_bytes[..]);
                    let mut expected_path = PathBuf::from("..").join(&dir_name);
                    expected_path.push("expected.merged");
                    let expected_content_bytes =
                        fs::read(expected_path).expect("could not read expected file");
                    let expected_content = String::from_utf8_lossy(&expected_content_bytes[..]);
                    trace!(
                        "comparing\n{}\nto expected:\n{}",
                        out_file_content,
                        expected_content
                    );
                    assert_eq!(expected_content, out_file_content);
                    break;
                }
                Ok(Err(Notification {
                    severity,
                    content,
                    line,
                })) => {
                    trace!(
                        "[{:?}]: getChunks: received notification[{:?}]...{}",
                        line,
                        severity,
                        content,
                    );
                }
                Ok(Ok(IndexingProgress::Progress { ticks: _t })) => {
                    trace!("progress...");
                }
                Ok(Ok(IndexingProgress::GotItem { item })) => {
                    trace!("got item...");
                    last_processed_line = item.r.1;
                }
                Ok(Ok(IndexingProgress::Stopped)) => {
                    trace!("stopped...");
                }
                Err(e) => {
                    error!("couldn't execute merge: {:?}", e);
                    break;
                }
            }
        }
    }

    // TODO test files with lines without timestamp
}
