use crate::*;

/// Represents the result of a command execution.
/// At the core level, this type is used for all commands invoked within an `UnboundSession`.
/// It is only used to indicate the successful completion or interruption of a command.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[cfg_attr(
    test,
    tslink::tslink(target = "./stypes/output/command.ts", module = "command")
)]
pub enum CommandOutcomeFoldersScanningResult {
    /// Indicates that the command was successfully completed.
    Finished(FoldersScanningResult),
    /// Indicates that the command execution was interrupted.
    Cancelled,
}

/// Represents the result of a command execution.
/// At the core level, this type is used for all commands invoked within an `UnboundSession`.
/// It is only used to indicate the successful completion or interruption of a command.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[cfg_attr(
    test,
    tslink::tslink(target = "./stypes/output/command.ts", module = "command")
)]
pub enum CommandOutcomeSerialPortsList {
    /// Indicates that the command was successfully completed.
    Finished(SerialPortsList),
    /// Indicates that the command execution was interrupted.
    Cancelled,
}

/// Represents the result of a command execution.
/// At the core level, this type is used for all commands invoked within an `UnboundSession`.
/// It is only used to indicate the successful completion or interruption of a command.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[cfg_attr(
    test,
    tslink::tslink(target = "./stypes/output/command.ts", module = "command")
)]
pub enum CommandOutcomeVoid {
    /// Indicates that the command was successfully completed.
    Finished,
    /// Indicates that the command execution was interrupted.
    Cancelled,
}

/// Represents the result of a command execution.
/// At the core level, this type is used for all commands invoked within an `UnboundSession`.
/// It is only used to indicate the successful completion or interruption of a command.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[cfg_attr(
    test,
    tslink::tslink(target = "./stypes/output/command.ts", module = "command")
)]
pub enum CommandOutcomei64 {
    /// Indicates that the command was successfully completed.
    Finished(i64),
    /// Indicates that the command execution was interrupted.
    Cancelled,
}

/// Represents the result of a command execution.
/// At the core level, this type is used for all commands invoked within an `UnboundSession`.
/// It is only used to indicate the successful completion or interruption of a command.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[cfg_attr(
    test,
    tslink::tslink(target = "./stypes/output/command.ts", module = "command")
)]
pub enum CommandOutcomeOptionalString {
    /// Indicates that the command was successfully completed.
    Finished(Option<String>),
    /// Indicates that the command execution was interrupted.
    Cancelled,
}

/// Represents the result of a command execution.
/// At the core level, this type is used for all commands invoked within an `UnboundSession`.
/// It is only used to indicate the successful completion or interruption of a command.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[cfg_attr(
    test,
    tslink::tslink(target = "./stypes/output/command.ts", module = "command")
)]
pub enum CommandOutcomeString {
    /// Indicates that the command was successfully completed.
    Finished(String),
    /// Indicates that the command execution was interrupted.
    Cancelled,
}

/// Represents the result of a command execution.
/// At the core level, this type is used for all commands invoked within an `UnboundSession`.
/// It is only used to indicate the successful completion or interruption of a command.
#[derive(Clone, Serialize, Deserialize, Debug)]
#[cfg_attr(
    test,
    tslink::tslink(target = "./stypes/output/command.ts", module = "command")
)]
pub enum CommandOutcomeBool {
    /// Indicates that the command was successfully completed.
    Finished(bool),
    /// Indicates that the command execution was interrupted.
    Cancelled,
}
