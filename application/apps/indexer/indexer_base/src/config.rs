// Copyright (c) 2020 E.S.R.Labs. All rights reserved.
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
use serde::{Deserialize, Serialize};
use std::{
    net::{IpAddr, SocketAddr},
    path,
};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Problem with configuration found: {0}")]
    Configuration(String),
    #[error("IO error: {0:?}")]
    Io(#[from] std::io::Error),
}

/// A IndexSection describes a section of a file by indicies
/// to identify lines 10-12 (inclusively) => first_line = 10, last_line = 12
/// to identify only line 13: first_line = 13, last_line = 13
#[derive(Serialize, Deserialize, Debug)]
pub struct IndexSection {
    pub first_line: usize,
    pub last_line: usize,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SectionConfig {
    pub sections: Vec<IndexSection>,
}

impl IndexSection {
    pub fn len(&self) -> usize {
        self.last_line - self.first_line + 1
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

#[derive(Debug)]
pub struct IndexingConfig {
    pub tag: String,
    pub chunk_size: usize,
    pub in_file: path::PathBuf,
    pub out_path: path::PathBuf,
    pub append: bool,
    pub watch: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UdpConnectionInfo {
    pub multicast_addr: Vec<MulticastInfo>,
}

/// network socket config
/// if udp packets are sent via multicast, then the `multicast_addr` has to
/// be specified
#[derive(Serialize, Deserialize, Debug)]
pub struct SocketConfig {
    pub udp_connection_info: Option<UdpConnectionInfo>,
    pub bind_addr: String,
    pub port: String,
}

impl SocketConfig {
    pub fn socket_addr(&self) -> Result<SocketAddr, Error> {
        // Touch IPv4
        let addr: Option<SocketAddr> = match format!("{}:{}", self.bind_addr, self.port).parse() {
            Ok(addr) => Some(addr),
            Err(_) => None,
        };
        if let Some(addr) = addr {
            Ok(addr)
        } else {
            // Touch IPv6
            format!("[{}]:{}", self.bind_addr, self.port)
                .parse()
                .map_err(|_| {
                    Error::Configuration(format!(
                        "Could not parse socket address from {}, port {}",
                        self.bind_addr, self.port
                    ))
                })
        }
    }
}

/// Multicast config information.
/// `multiaddr` address must be a valid multicast address
/// `interface` is the address of the local interface with which the
/// system should join the
/// multicast group. If it's equal to `INADDR_ANY` then an appropriate
/// interface is chosen by the system.
#[derive(Serialize, Deserialize, Debug)]
pub struct MulticastInfo {
    pub multiaddr: String,
    pub interface: Option<String>,
}

impl MulticastInfo {
    pub fn multicast_addr(&self) -> Result<IpAddr, Error> {
        self.multiaddr
            .to_string()
            .parse()
            .map_err(|e| Error::Configuration(format!("Could not parse mulitcast address: {}", e)))
    }
}
