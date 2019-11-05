use log::{Level, Metadata, Record};
use std::time::SystemTime;

pub struct SimpleLogger;

impl log::Log for SimpleLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= Level::Trace
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            println!(
                "[RUST]:{}({:?}) {} - {}",
                SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap()
                    .as_millis(),
                std::thread::current().id(),
                record.level(),
                record.args()
            );
        }
    }

    fn flush(&self) {}
}
