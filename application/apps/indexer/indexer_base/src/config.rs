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
use std::path;

#[derive(Debug)]
pub struct IndexingConfig<'a> {
    pub tag: &'a str,
    pub chunk_size: usize,
    pub in_file: path::PathBuf,
    pub out_path: &'a path::PathBuf,
    pub append: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct FibexConfig {
    pub fibex_file_paths: Vec<String>,
}
/// network socket config
/// if udp packets are sent via multicast, then the `multicast_addr` has to
/// be specified
#[derive(Serialize, Deserialize, Debug)]
pub struct SocketConfig {
    pub multicast_addr: Option<MulticastInfo>,
    pub bind_addr: String,
    pub port: String,
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
