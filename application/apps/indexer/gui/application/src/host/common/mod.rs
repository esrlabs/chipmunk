pub mod parsers;
pub mod sources;

// Slim source stream transport names to be used with the drop down.
#[derive(Debug, Clone, Copy)]
pub enum StreamNames {
    Process,
    Tcp,
    Udp,
    Serial,
}

impl StreamNames {
    pub const fn new() -> &'static [StreamNames] {
        // Reminder to add on new types
        match StreamNames::Process {
            StreamNames::Process => {}
            StreamNames::Tcp => {}
            StreamNames::Udp => {}
            StreamNames::Serial => {}
        };

        &[
            StreamNames::Process,
            StreamNames::Tcp,
            StreamNames::Udp,
            StreamNames::Serial,
        ]
    }
}
