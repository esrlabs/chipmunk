use crate::target::Target;

/// Prints an overview of targets dependencies in print-dot format for `Graphviz`
pub fn print_dependencies() {
    println!("digraph dependencies {{");

    for target in Target::all() {
        for dep in target.deps() {
            println!(r#"  "{target}"  -> "{dep}""#);
        }
    }

    println!("}}");
}
