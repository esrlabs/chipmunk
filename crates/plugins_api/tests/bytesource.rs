#[test]
fn bytesource_macro_tests() {
    // Setting this env variable will tell trybuild to rewrite stderr files for failing tests
    // on every run to skip comparing compile error messages since they do string comparison which
    // could lead to false negative on different Rust versions or environments.
    // trybuild spawns Cargo in a temporary crate that inherits root patches; quiet mode hides
    // Cargo's unused-patch warnings for GUI crates that this API crate does not depend on.
    // SAFETY: All tests either need those variables or don't check for them.
    unsafe {
        std::env::set_var("TRYBUILD", "overwrite");
        std::env::set_var("CARGO_TERM_QUIET", "true");
    }

    let t = trybuild::TestCases::new();

    t.pass("tests/bytesource_macro/imp_bytesource_pass.rs");
    t.pass("tests/bytesource_macro/imp_bytesource_diff_mod_pass.rs");
    t.pass("tests/bytesource_macro/extend_trait_pass.rs");

    t.compile_fail("tests/bytesource_macro/not_imp_bytesource_fail.rs");
    t.compile_fail("tests/bytesource_macro/expression_fail.rs");
}
