pub const ROW_NUMBER_SENTINAL: char = '\u{0002}';
pub const PLUGIN_ID_SENTINAL: char = '\u{0003}';

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
