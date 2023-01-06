use regex::Regex;
use std::path::PathBuf;
use thiserror::Error;

const ARGUMENTS_SEPORATOR: &str = "%sep%";

#[derive(Error, Debug)]
pub enum ArgumentsError {
    #[error("Deserialization error ({0})")]
    Deserialization(String),
    #[error("Format error ({0})")]
    Format(String),
    #[error("Validation error ({0})")]
    Validation(String),
    #[error("Location error ({0})")]
    Location(String),
}
pub struct Arguments {
    pub app: PathBuf,
    pub app_name: String,
    pub location: PathBuf,
    pub compressed: PathBuf,
    pub pid: Option<usize>,
    pub ppid: Option<usize>,
}

impl Arguments {
    pub fn new() -> Result<Self, ArgumentsError> {
        let args = std::env::args().collect::<Vec<String>>();
        log::debug!("Original arguments: {args:?}");
        let args_as_str = Self::deserialize_spaces(args.join(""))?;
        log::debug!("Merged args: {args_as_str}");
        let from = args_as_str
            .chars()
            .position(|c| c == '[')
            .ok_or(ArgumentsError::Format(String::from(
                "Fail to find symbol [ in arguments",
            )))?;
        let to = args_as_str
            .chars()
            .position(|c| c == ']')
            .ok_or(ArgumentsError::Format(String::from(
                "Fail to find symbol ] in arguments",
            )))?;
        if args_as_str.len() <= to {
            return Err(ArgumentsError::Format(format!(
                "Len of merged string {}, but right border: {to}",
                args_as_str.len()
            )));
        }
        let params_as_str = args_as_str[(from + 1)..to].to_string();
        log::debug!("extracted arguments: {params_as_str}");
        let params = params_as_str
            .split(ARGUMENTS_SEPORATOR)
            .collect::<Vec<&str>>();
        if params.len() < 2 {
            return Err(ArgumentsError::Format(format!(
                "Expecting at least 2 arguments; found {}",
                params.len()
            )));
        }
        let app = PathBuf::from(params[0]);
        let compressed = PathBuf::from(params[1]);
        if !app.exists() {
            return Err(ArgumentsError::Validation(format!(
                "{app:?} doesn't exist."
            )));
        }
        if !compressed.exists() {
            return Err(ArgumentsError::Validation(format!(
                "{app:?} doesn't exist."
            )));
        }
        let pid = Self::extract_usize(&params, "PID", 2);
        let ppid = Self::extract_usize(&params, "PPID", 3);
        let location = app
            .parent()
            .ok_or(ArgumentsError::Location(format!("No parent for {app:?}")))?
            .to_path_buf();
        let app_name = app
            .file_name()
            .ok_or(ArgumentsError::Location(format!(
                "No application name for {app:?}"
            )))?
            .to_string_lossy()
            .to_string();
        log::debug!("Summary of parsed arguments:\n- app: {app:?}\n- compressed: {compressed:?}\n- pid: {pid:?}\n- ppid: {ppid:?}\n- location: {location:?}\n- app_name: {app_name:?}");
        Ok(Self {
            app,
            compressed,
            pid,
            ppid,
            location,
            app_name,
        })
    }

    fn deserialize_spaces(str: String) -> Result<String, ArgumentsError> {
        let re = Regex::new(r"%20").map_err(|e| ArgumentsError::Deserialization(e.to_string()))?;
        Ok(re.replace_all(&str, " ").to_string())
    }

    fn extract_usize(params: &Vec<&str>, alias: &str, index: usize) -> Option<usize> {
        if params.len() > index {
            match params[index].parse::<usize>() {
                Ok(v) => Some(v),
                Err(e) => {
                    log::warn!("fail to parse {alias}; error: {e:?}");
                    None
                }
            }
        } else {
            None
        }
    }
}
