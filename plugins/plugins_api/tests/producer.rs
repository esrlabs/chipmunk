#[test]
fn producer_macro_tests() {
    // Setting this env variable will tell trybuild to rewrite stderr files for failing tests
    // on every run to skip comparing compile error messages since they do string comparison which
    // could lead to false negative on different Rust versions or environments.
    // SAFETY: All tests either need those variables or don't check for them
    unsafe {
        std::env::set_var("TRYBUILD", "overwrite");
    }

    let t = trybuild::TestCases::new();

    t.pass("tests/producer_macro/imp_producer_pass.rs");
    t.pass("tests/producer_macro/extend_trait_pass.rs");
    t.pass("tests/producer_macro/glob_import_pass.rs");
    t.pass("tests/producer_macro/imp_producer_diff_mod_pass.rs");

    t.compile_fail("tests/producer_macro/not_imp_producer_fail.rs");
    t.compile_fail("tests/producer_macro/expression_fail.rs");
}
