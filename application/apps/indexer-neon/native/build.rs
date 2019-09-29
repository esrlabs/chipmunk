#[cfg(target_os = "windows")]
extern crate cc;
extern crate neon_build;

#[cfg(target_os = "windows")]
fn compile_delay_load_hook() {
    cc::Build::new()
        .cpp(true)
        .static_crt(true)
        .file("src/win_delay_load_hook.cc")
        .compile("hook");
}
#[cfg(not(target_os = "windows"))]
fn compile_delay_load_hook() {}

fn main() {
    neon_build::setup(); // must be called in build.rs
    compile_delay_load_hook();
}
