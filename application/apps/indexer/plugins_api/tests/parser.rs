#[test]
fn parser_macro_tests() {
    // Setting this env variable will tell trybuild to rewrite stderr files for failing tests
    // on every run to skip comparing compile error messages since they do string comparison which
    // could lead to false negative on different Rust versions or environments.
    std::env::set_var("TRYBUILD", "overwrite");

    let t = trybuild::TestCases::new();

    t.pass("tests/parser_macro/imp_parser_pass.rs");
    t.compile_fail("tests/parser_macro/not_imp_parser_fail.rs");
    t.compile_fail("tests/parser_macro/extend_trait_fail.rs");
    t.compile_fail("tests/parser_macro/expression_fail.rs");
}
