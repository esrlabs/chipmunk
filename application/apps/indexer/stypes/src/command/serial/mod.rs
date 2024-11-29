#[cfg(test)]
mod proptest;

use crate::*;

#[derive(Clone, Serialize, Deserialize, Debug)]
#[extend::encode_decode]
pub struct SerialPortsList(pub Vec<String>);
