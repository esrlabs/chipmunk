use std::path::PathBuf;

#[derive(Debug, Clone)]
pub enum ParserType {
    Dlt,
    Pcap,
    // Dlt(DltParserSettings),
    // Pcap(PcapParserSettings),
    SomeIP(SomeIPParserSettings),
    Text,
}

#[derive(Debug, Clone)]
pub struct DltParserSettings {
    //fibex
}

#[derive(Debug, Clone)]
pub struct PcapParserSettings {}

#[derive(Debug, Clone)]
pub struct SomeIPParserSettings {}

#[derive(Debug, Clone)]
pub enum Transport {
    Process(ProcessTransportConfig),
    TCP(ProcessTransportConfig),
    UDP(UDPTransportConfig),
}

#[derive(Debug, Clone)]
pub struct ProcessTransportConfig {
    pub cmd: PathBuf,
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct TCPTransportConfig {}

#[derive(Debug, Clone)]
pub struct UDPTransportConfig {}

#[derive(Debug, Clone)]
pub enum Source {
    File(PathBuf, ParserType),
    Stream(Transport, ParserType),
}

// factory - should be here
