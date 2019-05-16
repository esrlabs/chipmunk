pub const ROW_NUMBER_SENTINAL: char = '\u{0002}';
pub const PLUGIN_ID_SENTINAL: char = '\u{0003}';
pub const SENTINAL_LENGTH: usize = 1;

#[inline]
pub fn is_newline(c: char) -> bool {
    match c {
        '\x0a' => true,
        '\x0d' => true,
        _ => false,
    }
}

#[inline]
pub fn create_tagged_line(
    tag: &str,
    out_buffer: &mut std::io::Write,
    trimmed_line: &str,
    line_nr: usize,
    with_newline: bool,
) -> std::io::Result<()> {
    write!(
        out_buffer,
        "{}{}{}{}{}{}{}{}",
        trimmed_line, //trimmed_line,
        PLUGIN_ID_SENTINAL,
        tag,
        PLUGIN_ID_SENTINAL,
        ROW_NUMBER_SENTINAL,
        line_nr,
        ROW_NUMBER_SENTINAL,
        if with_newline { "\n" } else { "" },
    )
}

#[inline]
pub fn extended_line_length(
    trimmed_len: usize,
    tag_len: usize,
    line_nr: usize,
    has_newline: bool,
) -> usize {
    trimmed_len
        + 4 * SENTINAL_LENGTH
        + tag_len
        + linenr_length(line_nr)
        + if has_newline { 1 } else { 0 }
}
fn linenr_length(linenr: usize) -> usize {
    if linenr == 0 {
        return 1;
    };
    let nr = linenr as f64;
    1 + nr.log10().floor() as usize
}

#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    use super::*;
    #[test]
    fn test_line_nr() {
        assert_eq!(1, linenr_length(0));
        assert_eq!(1, linenr_length(4));
        assert_eq!(2, linenr_length(10));
        assert_eq!(2, linenr_length(99));
        assert_eq!(3, linenr_length(100));
        assert_eq!(5, linenr_length(10000));
    }
}
