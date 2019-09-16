use log::{Level, Metadata, Record};

pub struct SimpleLogger;

impl log::Log for SimpleLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= Level::Trace
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            println!(
                "[RUST-{:?}] {} - {}",
                std::thread::current().id(),
                record.level(),
                record.args()
            );
        }
    }

    fn flush(&self) {}
}
