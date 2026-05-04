//! Shared helpers for log export UI behavior.

use stypes::ObserveOrigin;

use crate::session::ui::shared::SessionShared;

/// Returns the default file name for raw log export dialogs.
pub fn default_raw_file_name(shared: &SessionShared) -> String {
    const FALLBACK_FILE_NAME: &str = "indexed_export.bin";
    const SUFFIX: &str = "_export";
    const CONCAT_FILE_STEM: &str = "concat_export";

    let Some(origin) = shared.observe.operations().first().map(|op| &op.origin) else {
        return FALLBACK_FILE_NAME.to_owned();
    };

    let non_empty = |value: &std::ffi::OsStr| {
        let value = value.to_string_lossy();
        (!value.is_empty()).then(|| value.into_owned())
    };

    match origin {
        ObserveOrigin::File(_, _, path) => {
            let Some(file_stem) = path.file_stem().and_then(non_empty) else {
                return FALLBACK_FILE_NAME.to_owned();
            };

            if let Some(extension) = path.extension().and_then(non_empty) {
                format!("{file_stem}{SUFFIX}.{extension}")
            } else {
                format!("{file_stem}{SUFFIX}")
            }
        }
        ObserveOrigin::Concat(files) => {
            if let Some(extension) = files
                .first()
                .and_then(|(_, _, path)| path.extension())
                .and_then(non_empty)
            {
                format!("{CONCAT_FILE_STEM}.{extension}")
            } else {
                CONCAT_FILE_STEM.to_owned()
            }
        }
        ObserveOrigin::Stream(..) => FALLBACK_FILE_NAME.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use stypes::{FileFormat, ObserveOrigin};
    use uuid::Uuid;

    use crate::{
        host::common::parsers::ParserNames,
        session::{
            types::ObserveOperation,
            ui::shared::{SessionInfo, SessionShared},
        },
    };

    use super::default_raw_file_name;

    fn shared_for_origin(origin: ObserveOrigin) -> SessionShared {
        let session_info = SessionInfo {
            id: Uuid::new_v4(),
            title: "test".to_owned(),
            parser: ParserNames::Text,
            raw_export_supported: true,
        };
        let observe_op = ObserveOperation::new(Uuid::new_v4(), origin);

        SessionShared::new(session_info, observe_op)
    }

    #[test]
    fn file_name_uses_file_stem_and_extension() {
        let shared = shared_for_origin(ObserveOrigin::File(
            "source".to_owned(),
            FileFormat::Text,
            PathBuf::from("source.dlt"),
        ));

        assert_eq!(default_raw_file_name(&shared), "source_export.dlt");
    }

    #[test]
    fn file_name_uses_file_stem_without_extension() {
        let shared = shared_for_origin(ObserveOrigin::File(
            "source".to_owned(),
            FileFormat::Text,
            PathBuf::from("source"),
        ));

        assert_eq!(default_raw_file_name(&shared), "source_export");
    }

    #[test]
    fn concat_name_uses_first_file_extension() {
        let shared = shared_for_origin(ObserveOrigin::Concat(vec![
            (
                "first".to_owned(),
                FileFormat::Text,
                PathBuf::from("first.log"),
            ),
            (
                "second".to_owned(),
                FileFormat::Text,
                PathBuf::from("second.dlt"),
            ),
        ]));

        assert_eq!(default_raw_file_name(&shared), "concat_export.log");
    }
}
