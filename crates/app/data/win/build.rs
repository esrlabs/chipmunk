// Cargo build scripts are package-wide. This Windows asset hook delegates to
// the packaging helper that embeds chipmunk.ico into chipmunk.exe, so Explorer
// shows the portable executable with the Chipmunk app icon.
#[path = "../../../../development/packaging/windows_icon_resource.rs"]
mod windows_icon_resource;

fn main() {
    println!("cargo:rerun-if-changed=data/win/build.rs");
    println!("cargo:rerun-if-changed=../../development/packaging/windows_icon_resource.rs");

    windows_icon_resource::embed_app_icon("chipmunk", "data/win/chipmunk.ico");
}
