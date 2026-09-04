# UTF-16 test inputs

Log-like files in UTF-16, little and big endian, with and without a byte order mark, terminated by
`LF` or `CRLF`. They exist so UTF-16 support can be tried out by hand and is covered end to end by
the session snapshot tests.

All four share the same ten lines, which hold accents, Cyrillic, CJK, RTL text, surrogate pairs and
characters whose *bytes* are `0x0A` or `0x0D` (`U+0A0A`, `U+0D0A`, ...), so anything which splits
lines at the byte level cuts characters in half instead of ending lines.
