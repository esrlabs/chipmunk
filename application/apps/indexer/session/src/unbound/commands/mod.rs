mod cancel_test;
mod checksum;
mod dlt;
mod file;
mod folder;
pub mod plugins;
mod process;
mod regex;
mod serial;
mod shells;
mod sleep;
mod someip;

use crate::unbound::commands::someip::get_someip_statistic;
use plugins_host::plugins_manager::PluginsManager;
use tokio::sync::{RwLock, oneshot};

use super::signal::Signal;
use log::{debug, error};
use processor::search::filter::SearchFilter;

#[derive(Debug)]
pub enum Command {
    // This command is used only for testing/debug goals
    Sleep(
        u64,
        oneshot::Sender<Result<stypes::CommandOutcome<()>, stypes::ComputationError>>,
    ),
    FolderContent(
        Vec<String>,
        usize,
        usize,
        bool,
        bool,
        oneshot::Sender<
            Result<stypes::CommandOutcome<stypes::FoldersScanningResult>, stypes::ComputationError>,
        >,
    ),
    SpawnProcess(
        String,
        Vec<String>,
        oneshot::Sender<Result<stypes::CommandOutcome<()>, stypes::ComputationError>>,
    ),
    GetRegexError(
        SearchFilter,
        oneshot::Sender<Result<stypes::CommandOutcome<Option<String>>, stypes::ComputationError>>,
    ),
    Checksum(
        String,
        oneshot::Sender<Result<stypes::CommandOutcome<String>, stypes::ComputationError>>,
    ),
    GetDltStats(
        Vec<String>,
        oneshot::Sender<
            Result<stypes::CommandOutcome<stypes::DltStatisticInfo>, stypes::ComputationError>,
        >,
    ),
    GetSomeipStatistic(
        Vec<String>,
        oneshot::Sender<Result<stypes::CommandOutcome<String>, stypes::ComputationError>>,
    ),
    GetShellProfiles(
        oneshot::Sender<
            Result<stypes::CommandOutcome<stypes::ProfileList>, stypes::ComputationError>,
        >,
    ),
    GetContextEnvvars(
        oneshot::Sender<
            Result<stypes::CommandOutcome<stypes::MapKeyValue>, stypes::ComputationError>,
        >,
    ),
    SerialPortsList(
        oneshot::Sender<
            Result<stypes::CommandOutcome<stypes::SerialPortsList>, stypes::ComputationError>,
        >,
    ),
    IsFileBinary(
        String,
        oneshot::Sender<Result<stypes::CommandOutcome<bool>, stypes::ComputationError>>,
    ),
    CancelTest(
        i64,
        i64,
        oneshot::Sender<Result<stypes::CommandOutcome<i64>, stypes::ComputationError>>,
    ),
    /// Get all information of the installed plugins .
    InstalledPluginsList(
        oneshot::Sender<
            Result<stypes::CommandOutcome<stypes::PluginsList>, stypes::ComputationError>,
        >,
    ),
    /// Get all information of invalid plugins .
    InvalidPluginsList(
        oneshot::Sender<
            Result<stypes::CommandOutcome<stypes::InvalidPluginsList>, stypes::ComputationError>,
        >,
    ),
    /// Get the directory paths (considered ID) for installed plugins.
    InstalledPluginsPaths(
        oneshot::Sender<
            Result<stypes::CommandOutcome<stypes::PluginsPathsList>, stypes::ComputationError>,
        >,
    ),
    /// Get the directory paths (considered ID) for invalid plugins.
    InvalidPluginsPaths(
        oneshot::Sender<
            Result<stypes::CommandOutcome<stypes::PluginsPathsList>, stypes::ComputationError>,
        >,
    ),
    /// Get all info for the installed plugin with provided directory path (considered ID)
    InstalledPluginInfo(
        String,
        oneshot::Sender<
            Result<stypes::CommandOutcome<Option<stypes::PluginEntity>>, stypes::ComputationError>,
        >,
    ),
    /// Get all info for the invalid plugin with provided directory path (considered ID)
    InvalidPluginInfo(
        String,
        oneshot::Sender<
            Result<
                stypes::CommandOutcome<Option<stypes::InvalidPluginEntity>>,
                stypes::ComputationError,
            >,
        >,
    ),
    /// Retrieves runtime data for a plugin located at the specified path.
    PluginRunData(
        String,
        oneshot::Sender<
            Result<stypes::CommandOutcome<Option<stypes::PluginRunData>>, stypes::ComputationError>,
        >,
    ),
    /// Reload all the plugins from their directory.
    ReloadPlugins(oneshot::Sender<Result<stypes::CommandOutcome<()>, stypes::ComputationError>>),
    /// Adds a plugin with the given directory path and optional plugin type.
    AddPlugin(
        String,
        Option<stypes::PluginType>,
        oneshot::Sender<Result<stypes::CommandOutcome<()>, stypes::ComputationError>>,
    ),
    /// Removes the plugin with the given directory path.
    RemovePlugin(
        String,
        oneshot::Sender<Result<stypes::CommandOutcome<()>, stypes::ComputationError>>,
    ),
}

impl std::fmt::Display for Command {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Command::Sleep(_, _) => "Sleep",
                Command::CancelTest(_, _, _) => "CancelTest",
                Command::SpawnProcess(_, _, _) => "Spawning process",
                Command::FolderContent(_, _, _, _, _, _) => "Getting folder's content",
                Command::GetShellProfiles(_) => "Getting shell profiles",
                Command::GetContextEnvvars(_) => "Getting context envvars",
                Command::SerialPortsList(_) => "Getting serial ports list",
                Command::Checksum(_, _) => "Calculating file's checksum",
                Command::GetDltStats(_, _) => "Getting dlt stats",
                Command::GetSomeipStatistic(_, _) => "Getting someip statistic",
                Command::GetRegexError(_, _) => "Checking regex",
                Command::IsFileBinary(_, _) => "Checking if file is binary",
                Command::InstalledPluginsList(..) => "Getting installed plugins",
                Command::InvalidPluginsList(..) => "Getting invalid plugins",
                Command::InstalledPluginsPaths(..) => "Getting installed plugins paths",
                Command::InvalidPluginsPaths(..) => "Getting invaild plugins paths",
                Command::InstalledPluginInfo(..) => "Getting installed plugin info",
                Command::InvalidPluginInfo(..) => "Getting invalid plugin info",
                Command::PluginRunData(..) => "Getting plugin run data",
                Command::ReloadPlugins(..) => "Reloading plugins' information",
                Command::AddPlugin(..) => "Adding plugin",
                Command::RemovePlugin(..) => "Removing plugin",
            }
        )
    }
}

pub async fn process(command: Command, signal: Signal, plugins_manager: &RwLock<PluginsManager>) {
    let cmd = command.to_string();
    debug!("Processing command: {cmd}");
    if match command {
        Command::Sleep(ms, tx) => tx.send(sleep::sleep(ms, signal).await).is_err(),
        Command::FolderContent(paths, depth, max_len, include_files, include_folders, tx) => tx
            .send(folder::get_folder_content(
                &paths,
                depth,
                max_len,
                include_files,
                include_folders,
                signal,
            ))
            .is_err(),
        Command::SpawnProcess(path, args, tx) => {
            tx.send(process::execute(path, args, signal)).is_err()
        }
        Command::GetRegexError(filter, tx) => {
            tx.send(regex::get_filter_error(filter, signal)).is_err()
        }
        Command::Checksum(file, tx) => tx.send(checksum::checksum(&file, signal)).is_err(),
        Command::GetDltStats(files, tx) => tx.send(dlt::stats(files, signal)).is_err(),
        Command::GetSomeipStatistic(files, tx) => {
            tx.send(get_someip_statistic(files, signal)).is_err()
        }
        Command::GetShellProfiles(tx) => tx.send(shells::get_valid_profiles(signal)).is_err(),
        Command::GetContextEnvvars(tx) => tx.send(shells::get_context_envvars(signal)).is_err(),
        Command::SerialPortsList(tx) => tx.send(serial::available_ports(signal)).is_err(),
        Command::IsFileBinary(file_path, tx) => tx.send(file::is_file_binary(file_path)).is_err(),
        Command::CancelTest(a, b, tx) => tx
            .send(cancel_test::cancel_test(a, b, signal).await)
            .is_err(),
        Command::InstalledPluginsList(tx) => tx
            .send(plugins::installed_plugins_list(plugins_manager, signal).await)
            .is_err(),
        Command::InvalidPluginsList(tx) => tx
            .send(plugins::invalid_plugins_list(plugins_manager, signal).await)
            .is_err(),
        Command::InstalledPluginsPaths(tx) => tx
            .send(plugins::installed_plugins_paths(plugins_manager, signal).await)
            .is_err(),
        Command::InvalidPluginsPaths(tx) => tx
            .send(plugins::invalid_plugins_paths(plugins_manager, signal).await)
            .is_err(),
        Command::InstalledPluginInfo(path, tx) => tx
            .send(plugins::installed_plugins_info(path, plugins_manager, signal).await)
            .is_err(),
        Command::InvalidPluginInfo(path, tx) => tx
            .send(plugins::invalid_plugins_info(path, plugins_manager, signal).await)
            .is_err(),
        Command::PluginRunData(path, tx) => tx
            .send(plugins::get_plugin_run_data(path, plugins_manager, signal).await)
            .is_err(),
        Command::ReloadPlugins(tx) => tx
            .send(plugins::reload_plugins(plugins_manager, signal).await)
            .is_err(),
        Command::AddPlugin(path, typ, tx) => tx
            .send(plugins::add_plugin(path, typ, plugins_manager, signal).await)
            .is_err(),
        Command::RemovePlugin(path, tx) => tx
            .send(plugins::remove_plugin(path, plugins_manager, signal).await)
            .is_err(),
    } {
        error!("Fail to send response for command: {cmd}");
    }
}

pub fn err(command: Command, err: stypes::ComputationError) {
    let cmd = command.to_string();
    if match command {
        Command::Sleep(_, tx) => tx.send(Err(err)).is_err(),
        Command::FolderContent(_path, _depth, _max_len, _, _, tx) => tx.send(Err(err)).is_err(),
        Command::SpawnProcess(_path, _args, tx) => tx.send(Err(err)).is_err(),
        Command::GetRegexError(_filter, tx) => tx.send(Err(err)).is_err(),
        Command::Checksum(_file, tx) => tx.send(Err(err)).is_err(),
        Command::GetDltStats(_files, tx) => tx.send(Err(err)).is_err(),
        Command::GetSomeipStatistic(_files, tx) => tx.send(Err(err)).is_err(),
        Command::GetShellProfiles(tx) => tx.send(Err(err)).is_err(),
        Command::GetContextEnvvars(tx) => tx.send(Err(err)).is_err(),
        Command::SerialPortsList(tx) => tx.send(Err(err)).is_err(),
        Command::IsFileBinary(_filepath, tx) => tx.send(Err(err)).is_err(),
        Command::CancelTest(_a, _b, tx) => tx.send(Err(err)).is_err(),
        Command::InstalledPluginsList(tx) => tx.send(Err(err)).is_err(),
        Command::InvalidPluginsList(tx) => tx.send(Err(err)).is_err(),
        Command::InstalledPluginsPaths(tx) => tx.send(Err(err)).is_err(),
        Command::InvalidPluginsPaths(tx) => tx.send(Err(err)).is_err(),
        Command::InstalledPluginInfo(_, tx) => tx.send(Err(err)).is_err(),
        Command::InvalidPluginInfo(_, tx) => tx.send(Err(err)).is_err(),
        Command::PluginRunData(_, tx) => tx.send(Err(err)).is_err(),
        Command::ReloadPlugins(tx) => tx.send(Err(err)).is_err(),
        Command::AddPlugin(_, _, tx) => tx.send(Err(err)).is_err(),
        Command::RemovePlugin(_, tx) => tx.send(Err(err)).is_err(),
    } {
        error!("Fail to send error response for command: {cmd}");
    }
}
