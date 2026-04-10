//! Source-key generation for recent-session source snapshots.
//!
//! The key is derived from the ordered source snapshot shape and encoded as a
//! compact hex digest.

use std::path::Path;

use blake3::Hasher;
use stypes::{
    FileFormat, MulticastInfo, ProcessTransportConfig, SerialTransportConfig, ShellProfile,
    ShellType, TCPTransportConfig, Transport, UDPTransportConfig,
};

use super::{RecentSessionSource, RecentSourceSnapshot};

/// Builds the persisted source key for one ordered source snapshot.
pub fn from_snapshot(snapshot: &RecentSourceSnapshot) -> String {
    let RecentSourceSnapshot { sources } = snapshot;

    let mut hasher = Hasher::new();
    hasher.update(&(sources.len() as u64).to_le_bytes());

    // Source order is part of the recent-session identity.
    for source in sources {
        hash_source(&mut hasher, source);
    }

    hasher.finalize().to_hex().to_string()
}

/// Feeds one source item into the digest, preserving source order and variant.
fn hash_source(hasher: &mut Hasher, source: &RecentSessionSource) {
    match source {
        RecentSessionSource::File { format, path } => {
            hasher.update(&[0]);
            hash_file_format(hasher, *format);
            hash_path(hasher, path);
        }
        RecentSessionSource::Stream { transport } => {
            hasher.update(&[1]);
            hash_transport(hasher, transport);
        }
    }
}

/// Feeds the file-format discriminant into the digest.
fn hash_file_format(hasher: &mut Hasher, format: FileFormat) {
    let tag = match format {
        FileFormat::PcapNG => 0,
        FileFormat::PcapLegacy => 1,
        FileFormat::Text => 2,
        FileFormat::Binary => 3,
    };
    hasher.update(&[tag]);
}

/// Feeds the full transport configuration into the digest.
fn hash_transport(hasher: &mut Hasher, transport: &Transport) {
    match transport {
        Transport::Process(ProcessTransportConfig {
            cwd,
            command,
            shell,
        }) => {
            hasher.update(&[0]);
            hash_path(hasher, cwd);
            hash_bytes(hasher, command.as_bytes());

            match shell {
                Some(ShellProfile { shell, path }) => {
                    hasher.update(&[1]);

                    let shell_tag = match shell {
                        ShellType::Bash => 0,
                        ShellType::Zsh => 1,
                        ShellType::Fish => 2,
                        ShellType::NuShell => 3,
                        ShellType::Elvish => 4,
                        ShellType::Pwsh => 5,
                    };
                    hasher.update(&[shell_tag]);
                    hash_path(hasher, path);
                }
                None => {
                    hasher.update(&[0]);
                }
            }
        }
        Transport::TCP(TCPTransportConfig { bind_addr }) => {
            hasher.update(&[1]);
            hash_bytes(hasher, bind_addr.as_bytes());
        }
        Transport::UDP(UDPTransportConfig {
            bind_addr,
            multicast,
        }) => {
            hasher.update(&[2]);
            hash_bytes(hasher, bind_addr.as_bytes());
            hasher.update(&(multicast.len() as u64).to_le_bytes());
            for MulticastInfo {
                multiaddr,
                interface,
            } in multicast
            {
                hash_bytes(hasher, multiaddr.as_bytes());
                match interface {
                    Some(interface) => {
                        hasher.update(&[1]);
                        hash_bytes(hasher, interface.as_bytes());
                    }
                    None => {
                        hasher.update(&[0]);
                    }
                }
            }
        }
        Transport::Serial(SerialTransportConfig {
            path,
            baud_rate,
            data_bits,
            flow_control,
            parity,
            stop_bits,
            send_data_delay,
            exclusive,
        }) => {
            hasher.update(&[3]);
            hash_bytes(hasher, path.as_bytes());
            hasher.update(&baud_rate.to_le_bytes());
            hasher.update(&[*data_bits]);
            hasher.update(&[*flow_control]);
            hasher.update(&[*parity]);
            hasher.update(&[*stop_bits]);
            hasher.update(&[*send_data_delay]);
            hasher.update(&[u8::from(*exclusive)]);
        }
    }
}

/// Feeds a byte slice with its length prefix to avoid ambiguous concatenation.
fn hash_bytes(hasher: &mut Hasher, bytes: &[u8]) {
    // Without the length, ["ab", "c"] and ["a", "bc"] would hash the same.
    hasher.update(&(bytes.len() as u64).to_le_bytes());
    hasher.update(bytes);
}

/// Feeds the stored path value as-is into the digest.
fn hash_path(hasher: &mut Hasher, path: &Path) {
    hash_bytes(hasher, path.to_string_lossy().as_bytes());
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{TCPTransportConfig, Transport};

    use super::*;
    use crate::host::ui::storage::RecentSessionSnapshot;

    #[test]
    fn source_key_respects_order() {
        let first = PathBuf::from("first.log");
        let second = PathBuf::from("second.log");

        let left = RecentSourceSnapshot {
            sources: vec![
                RecentSessionSource::File {
                    format: FileFormat::Text,
                    path: first.clone(),
                },
                RecentSessionSource::File {
                    format: FileFormat::Text,
                    path: second.clone(),
                },
            ],
        };
        let right = RecentSourceSnapshot {
            sources: vec![
                RecentSessionSource::File {
                    format: FileFormat::Text,
                    path: second,
                },
                RecentSessionSource::File {
                    format: FileFormat::Text,
                    path: first,
                },
            ],
        };

        assert_ne!(left.source_key(), right.source_key());
    }

    #[test]
    fn source_key_is_hex_digest() {
        let snapshot = RecentSourceSnapshot {
            sources: vec![RecentSessionSource::Stream {
                transport: Transport::TCP(TCPTransportConfig {
                    bind_addr: String::from("127.0.0.1:5556"),
                }),
            }],
        };

        let source_key = snapshot.source_key();
        assert_eq!(source_key.len(), 64);
        assert!(source_key.bytes().all(|byte| byte.is_ascii_hexdigit()));
    }

    #[test]
    fn source_key_ignores_parser() {
        let path = PathBuf::from("chipmunk-source-key-parser.log");
        let text = RecentSessionSnapshot::from_observe_options(
            "text".into(),
            stypes::ObserveOptions::file(
                path.clone(),
                FileFormat::Text,
                stypes::ParserType::Text(()),
            ),
        );
        let someip = RecentSessionSnapshot::from_observe_options(
            "someip".into(),
            stypes::ObserveOptions::file(
                path,
                FileFormat::Text,
                stypes::ParserType::SomeIp(stypes::SomeIpParserSettings {
                    fibex_file_paths: None,
                }),
            ),
        );

        assert_eq!(text.source_key, someip.source_key);
    }
}
