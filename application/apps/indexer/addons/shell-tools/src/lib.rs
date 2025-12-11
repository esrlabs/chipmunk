use std::{ffi::OsStr, path::Path, sync::LazyLock};

use stypes::{ShellProfile, ShellType};

/// Load and get the available shells on the current platform
///
/// # Note
///
/// This function will check for pre defined shells if they are installed
/// on the system and will not discover other shells.
pub fn get_available_shells() -> &'static [ShellProfile] {
    static SHELLS: LazyLock<Vec<ShellProfile>> = LazyLock::new(load_shells);

    &SHELLS
}

fn load_shells() -> Vec<ShellProfile> {
    log::trace!("Start loading shells");

    let mut shells = Vec::new();
    for &shell in ShellType::all() {
        for bin_name in shell.binary_names() {
            match which::which_all_global(bin_name) {
                Ok(paths) => {
                    for path in paths {
                        if !is_path_valid(shell, &path) || is_path_duplicated(&path, &shells) {
                            continue;
                        }
                        let profile = ShellProfile { shell, path };
                        shells.push(profile);
                    }
                }
                Err(err) => {
                    log::trace!("No shell found for {shell}. Message: {err}");
                }
            };
        }
    }

    log::trace!("Finish loading shells. Found {} shells", shells.len());

    shells
}

fn is_path_valid(shell: ShellType, path: &Path) -> bool {
    match shell {
        ShellType::Bash
        | ShellType::Zsh
        | ShellType::Fish
        | ShellType::NuShell
        | ShellType::Elvish => true,
        ShellType::Pwsh => {
            if cfg!(windows) {
                // Filter out `Microsoft/WindowsApps` stubs. These are not real
                // executables and will incorrectly launch the Microsoft Store.
                let microsoft_dir = OsStr::new("microsoft");
                let windowsapps_dir = OsStr::new("windowsapps");
                let mut path_parts = path.components().peekable();
                while let Some(part) = path_parts.next() {
                    if part.as_os_str().eq_ignore_ascii_case(microsoft_dir) {
                        let Some(next) = path_parts.peek() else {
                            return true;
                        };

                        if next.as_os_str().eq_ignore_ascii_case(windowsapps_dir) {
                            return false;
                        }
                    }
                }
                true
            } else {
                true
            }
        }
    }
}

fn is_path_duplicated(current_path: &Path, shells: &[ShellProfile]) -> bool {
    shells.iter().any(|shell| {
        if cfg!(windows) {
            shell
                .path
                .as_os_str()
                .eq_ignore_ascii_case(current_path.as_os_str())
        } else {
            // On Unix system 'bin' directory will be often symlinked in different places
            // like `/bin/` -> `/usr/bin/`. This will lead to have duplication of the same shell.
            shell.path.file_name() == current_path.file_name()
                && (shell.path.parent().is_some_and(|p| p.is_symlink())
                    || current_path.parent().is_some_and(|p| p.is_symlink()))
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// Tests that all none Pwsh shell types always return true.
    #[test]
    fn test_non_pwsh_shells_are_always_valid() {
        let shells = [
            ShellType::Bash,
            ShellType::Zsh,
            ShellType::Fish,
            ShellType::NuShell,
            ShellType::Elvish,
        ];

        // A path that would be invalid for Pwsh
        let stub_path = PathBuf::from("C:\\Users\\Test\\Microsoft\\WindowsApps\\bash.exe");
        // A normal path
        let normal_path = PathBuf::from("/usr/bin/zsh");

        for &shell in &shells {
            assert!(
                is_path_valid(shell, &stub_path),
                "{:?} should be valid regardless of path",
                shell
            );
            assert!(
                is_path_valid(shell, &normal_path),
                "{:?} should be valid regardless of path",
                shell
            );
        }
    }

    /// Tests Pwsh on Windows with valid paths.
    #[test]
    #[cfg(windows)]
    fn test_pwsh_valid_paths_on_windows() {
        // A standard, valid install path
        let valid_path = PathBuf::from("C:\\Program Files\\PowerShell\\7\\pwsh.exe");
        assert!(is_path_valid(ShellType::Pwsh, &valid_path));

        // A path that contains "microsoft" but NOT followed by "windowsapps"
        let false_positive_path = PathBuf::from("C:\\Program Files\\Microsoft\\SomeTool\\pwsh.exe");
        assert!(is_path_valid(ShellType::Pwsh, &false_positive_path));

        // A path that contains "windowsapps" but NOT preceded by "microsoft"
        let false_positive_path_2 = PathBuf::from("C:\\MyTools\\WindowsApps\\pwsh.exe");
        assert!(is_path_valid(ShellType::Pwsh, &false_positive_path_2));

        // A path where "microsoft" is the last component
        let edge_case_path = PathBuf::from("C:\\Users\\microsoft");
        assert!(is_path_valid(ShellType::Pwsh, &edge_case_path));
    }

    /// Tests Pwsh on Windows with invalid stub paths.
    #[test]
    #[cfg(windows)]
    fn test_pwsh_invalid_stub_paths_on_windows() {
        // The canonical invalid stub path
        let stub_path =
            PathBuf::from("C:\\Users\\Test\\AppData\\Local\\Microsoft\\WindowsApps\\pwsh.exe");
        assert!(!is_path_valid(ShellType::Pwsh, &stub_path));

        // A root-level stub path
        let root_stub_path = PathBuf::from("D:\\Microsoft\\WindowsApps\\pwsh.exe");
        assert!(!is_path_valid(ShellType::Pwsh, &root_stub_path));

        // A path that is just the invalid sequence
        let short_stub_path = PathBuf::from("C:\\Microsoft\\WindowsApps");
        assert!(!is_path_valid(ShellType::Pwsh, &short_stub_path));
    }

    /// Tests that case insensitivity works for stub detection.
    #[test]
    #[cfg(windows)]
    fn test_pwsh_invalid_stub_path_case_insensitive() {
        let path1 =
            PathBuf::from("C:\\Users\\Test\\AppData\\Local\\MICROSOFT\\windowsapps\\pwsh.exe");
        assert!(!is_path_valid(ShellType::Pwsh, &path1));

        let path2 =
            PathBuf::from("C:\\Users\\Test\\AppData\\Local\\microsoft\\WINDOWSAPPS\\pwsh.exe");
        assert!(!is_path_valid(ShellType::Pwsh, &path2));

        let path3 =
            PathBuf::from("C:\\Users\\Test\\AppData\\Local\\MiCrOsOfT\\wInDoWsApPs\\pwsh.exe");
        assert!(!is_path_valid(ShellType::Pwsh, &path3));
    }

    /// Tests that Pwsh is always considered valid on non-Windows platforms.
    #[test]
    #[cfg(not(windows))]
    fn test_pwsh_is_always_valid_on_non_windows() {
        // A path that would be invalid on Windows
        let stub_like_path = PathBuf::from("/home/user/my-tools/Microsoft/WindowsApps/pwsh");
        assert!(is_path_valid(ShellType::Pwsh, &stub_like_path));

        // A normal Linux path
        let normal_path = PathBuf::from("/usr/bin/pwsh");
        assert!(is_path_valid(ShellType::Pwsh, &normal_path));
    }
}
