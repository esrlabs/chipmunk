use std::net::SocketAddr;

#[derive(Debug, Clone)]
pub struct TcpConfig {
    pub bind_addr: String,
    err_msg: Option<&'static str>,
}

impl TcpConfig {
    pub fn new() -> Self {
        let mut config = Self {
            bind_addr: String::new(),
            err_msg: None,
        };
        config.validate();

        config
    }

    pub fn is_valid(&self) -> bool {
        self.err_msg.is_none()
    }

    pub fn get_err_msg(&self) -> Option<&str> {
        self.err_msg
    }

    pub fn validation_errors(&self) -> Vec<&str> {
        if let Some(msg) = self.err_msg {
            vec![msg]
        } else {
            Vec::new()
        }
    }

    pub fn validate(&mut self) {
        if self.bind_addr.is_empty() {
            self.err_msg = Some("Socket Address is required");
        } else if self.bind_addr.parse::<SocketAddr>().is_err() {
            self.err_msg = Some("Socket Address is invalid");
        } else {
            self.err_msg = None;
        }
    }
}

impl From<TcpConfig> for stypes::TCPTransportConfig {
    fn from(config: TcpConfig) -> Self {
        Self {
            bind_addr: config.bind_addr,
        }
    }
}
