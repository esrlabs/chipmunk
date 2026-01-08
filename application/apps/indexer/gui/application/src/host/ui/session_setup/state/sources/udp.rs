use std::net::{IpAddr, SocketAddr};

#[derive(Debug, Clone)]
pub struct UdpConfig {
    pub bind_addr: String,
    bind_err_msg: Option<&'static str>,
    pub multicasts: Vec<MulticastItem>,
}

#[derive(Debug, Clone)]
pub struct MulticastItem {
    pub multi_address: String,
    pub interface_addr: String,
    pub multi_address_err: Option<&'static str>,
    pub interface_addr_err: Option<&'static str>,
}

impl MulticastItem {
    pub fn new() -> Self {
        let mut item = Self {
            multi_address: String::from("255.255.255.255"),
            interface_addr: String::from("0.0.0.0"),
            multi_address_err: None,
            interface_addr_err: None,
        };

        item.validate();

        item
    }

    pub fn validate(&mut self) {
        self.multi_address_err = if self.multi_address.is_empty() {
            Some("Address is required")
        } else if self.multi_address.parse::<IpAddr>().is_err() {
            Some("Address is invalid")
        } else {
            None
        };

        self.interface_addr_err = if self.interface_addr.is_empty() {
            Some("Interface address is required")
        } else if self.interface_addr.parse::<IpAddr>().is_err() {
            Some("Interface Address is invalid")
        } else {
            None
        }
    }

    pub fn is_valid(&self) -> bool {
        self.multi_address_err.is_none() && self.interface_addr_err.is_none()
    }

    pub fn validation_errors(&self) -> Vec<&str> {
        [self.multi_address_err, self.interface_addr_err]
            .iter()
            .filter_map(|err| *err)
            .collect()
    }
}

impl UdpConfig {
    pub fn new() -> Self {
        let mut config = Self {
            bind_addr: String::new(),
            bind_err_msg: None,
            multicasts: Vec::new(),
        };

        config.validate();

        config
    }

    pub fn validate(&mut self) {
        self.bind_err_msg = if self.bind_addr.is_empty() {
            Some("Socket Address is required")
        } else if self.bind_addr.parse::<SocketAddr>().is_err() {
            Some("Socket Address is invalid")
        } else {
            None
        };

        self.multicasts.iter_mut().for_each(|item| item.validate());
    }

    pub fn is_valid(&self) -> bool {
        self.bind_err_msg.is_none() && self.multicasts.iter().all(|item| item.is_valid())
    }

    pub fn validation_errors(&self) -> Vec<&str> {
        let mut errors = Vec::new();

        if let Some(err_msg) = self.bind_err_msg {
            errors.push(err_msg);
        }

        errors.extend(
            self.multicasts
                .iter()
                .flat_map(|item| item.validation_errors()),
        );

        errors
    }

    pub fn get_bind_err(&self) -> Option<&str> {
        self.bind_err_msg
    }
}

impl From<MulticastItem> for stypes::MulticastInfo {
    fn from(item: MulticastItem) -> Self {
        Self {
            multiaddr: item.multi_address,
            interface: Some(item.interface_addr),
        }
    }
}

impl From<UdpConfig> for stypes::UDPTransportConfig {
    fn from(config: UdpConfig) -> Self {
        Self {
            bind_addr: config.bind_addr,
            multicast: config
                .multicasts
                .into_iter()
                .map(stypes::MulticastInfo::from)
                .collect(),
        }
    }
}
