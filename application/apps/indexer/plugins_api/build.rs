fn main() {
    // Make sure one feature at most is enabled. Enabling more than one feature leads to linking
    // and validation errors since the macro [`wit_bidngen::generat!`] will be called multiple
    // times generating conflicting types.
    //
    // This check is enabled on release mode only to allow rust analyzer to work with all targets
    // while in development
    #[cfg(all(not(debug_assertions), feature = "parser", feature = "bytesource"))]
    compile_error!(
        "Only one feature can be enabled at a time.\n\
        Enabling more than one feature will generate conflicting types"
    );
}
