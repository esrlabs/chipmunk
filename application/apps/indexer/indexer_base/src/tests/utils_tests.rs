#[cfg(test)]
mod tests {
    // Note this useful idiom: importing names from outer (for mod tests) scope.
    // use super::*;
    use crate::utils::*;

    #[test]
    fn test_line_nr() {
        assert_eq!(1, number_string_len(0));
        assert_eq!(1, number_string_len(4));
        assert_eq!(2, number_string_len(10));
        assert_eq!(2, number_string_len(99));
        assert_eq!(3, number_string_len(100));
        assert_eq!(5, number_string_len(10000));
    }
}
