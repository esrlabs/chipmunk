// Release Windows builds are GUI apps. Without this subsystem marker, launching
// chipmunk.exe from Explorer or the installer keeps an extra console window open.
#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

fn main() -> anyhow::Result<()> {
    app::run_app()
}
