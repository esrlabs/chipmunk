/// A set of utility traits designed to simplify working with component configuration fields.
///
/// While the use of these traits is entirely optional, they can significantly reduce boilerplate code
/// and improve overall readability when extracting typed values from field definitions.
use crate::*;

/// Helper function that creates a `NativeError` indicating a missing field in configuration.
pub fn missed_field_err(field: &str) -> NativeError {
    NativeError {
        kind: NativeErrorKind::Configuration,
        severity: Severity::ERROR,
        message: Some(format!("Missed field {field} ")),
    }
}

/// A wrapper structure that holds an extracted field value along with its ID.
pub struct Extracted<'a, T> {
    /// The extracted value.
    pub value: T,
    /// The identifier of the field from which the value was extracted.
    pub id: &'a str,
}

impl<'a, T> Extracted<'a, T> {
    /// Creates a new `Extracted` instance with the provided field ID and value.
    pub fn new(id: &'a str, value: T) -> Self {
        Self { value, id }
    }
}

/// Internal helper function used to avoid code duplication.
/// Searches for a field by its key and attempts to extract a value of the specified type.
fn extract_from_fields_by_key<'a, T>(fields: &'a [Field], key: &str) -> Option<Extracted<'a, T>>
where
    &'a Field: ExtractAs<T>,
{
    fields
        .iter()
        .find(|field| field.id == key)
        .and_then(|field| {
            field
                .extract_as()
                .map(|v| Extracted::new(field.id.as_str(), v))
        })
}

/// Trait that provides typed extraction from a collection of `Field` objects using a string key.
pub trait ExtractByKey<T> {
    /// Attempts to extract a value of type `T` by field ID.
    ///
    /// Returns `Some(Extracted<T>)` if the field exists and the value can be extracted,
    /// otherwise returns `None`.
    fn extract_by_key<'a>(&'a self, key: &str) -> Option<Extracted<'a, T>>;
}

impl ExtractByKey<String> for &[Field] {
    fn extract_by_key<'a>(&'a self, key: &str) -> Option<Extracted<'a, String>> {
        extract_from_fields_by_key(self, key)
    }
}

impl ExtractByKey<i64> for &[Field] {
    fn extract_by_key<'a>(&'a self, key: &str) -> Option<Extracted<'a, i64>> {
        extract_from_fields_by_key(self, key)
    }
}

impl ExtractByKey<u8> for &[Field] {
    fn extract_by_key<'a>(&'a self, key: &str) -> Option<Extracted<'a, u8>> {
        extract_from_fields_by_key(self, key)
    }
}

impl ExtractByKey<u16> for &[Field] {
    fn extract_by_key<'a>(&'a self, key: &str) -> Option<Extracted<'a, u16>> {
        extract_from_fields_by_key(self, key)
    }
}

impl ExtractByKey<u32> for &[Field] {
    fn extract_by_key<'a>(&'a self, key: &str) -> Option<Extracted<'a, u32>> {
        extract_from_fields_by_key(self, key)
    }
}

impl ExtractByKey<u64> for &[Field] {
    fn extract_by_key<'a>(&'a self, key: &str) -> Option<Extracted<'a, u64>> {
        extract_from_fields_by_key(self, key)
    }
}

impl ExtractByKey<usize> for &[Field] {
    fn extract_by_key<'a>(&'a self, key: &str) -> Option<Extracted<'a, usize>> {
        extract_from_fields_by_key(self, key)
    }
}

impl ExtractByKey<bool> for &[Field] {
    fn extract_by_key<'a>(&'a self, key: &str) -> Option<Extracted<'a, bool>> {
        extract_from_fields_by_key(self, key)
    }
}

impl<'l> ExtractByKey<&'l Vec<Field>> for &'l [Field] {
    fn extract_by_key<'a>(&'a self, key: &str) -> Option<Extracted<'a, &'l Vec<Field>>> {
        extract_from_fields_by_key(self, key)
    }
}

impl<'l> ExtractByKey<&'l Vec<PathBuf>> for &'l [Field] {
    fn extract_by_key<'a>(&'a self, key: &str) -> Option<Extracted<'a, &'l Vec<PathBuf>>> {
        extract_from_fields_by_key(self, key)
    }
}

impl<'l> ExtractByKey<&'l HashMap<String, Vec<String>>> for &'l [Field] {
    fn extract_by_key<'a>(
        &'a self,
        key: &str,
    ) -> Option<Extracted<'a, &'l HashMap<String, Vec<String>>>> {
        extract_from_fields_by_key(self, key)
    }
}
/// A trait that provides type-specific extraction logic from a `Field`.
///
/// This trait allows extracting a value of type `T` from a `Field`
/// if the internal representation supports it.
///
/// Returns `Some(T)` if the conversion is successful, otherwise `None`.
pub trait ExtractAs<T> {
    /// Attempts to extract a value of type `T` from the field.
    fn extract_as(&self) -> Option<T>;
}

impl ExtractAs<String> for &Field {
    fn extract_as(&self) -> Option<String> {
        match &self.value {
            Value::String(value) => Some(value.to_owned()),
            Value::Boolean(..)
            | Value::Directories(..)
            | Value::Directory(..)
            | Value::Fields(..)
            | Value::File(..)
            | Value::Files(..)
            | Value::KeyNumber(..)
            | Value::KeyNumbers(..)
            | Value::KeyString(..)
            | Value::KeyStrings(..)
            | Value::Number(..)
            | Value::Numbers(..)
            | Value::Strings(..) => None,
        }
    }
}

impl ExtractAs<i64> for &Field {
    fn extract_as(&self) -> Option<i64> {
        match &self.value {
            Value::Number(value) => Some(*value),
            Value::Boolean(..)
            | Value::Directories(..)
            | Value::Directory(..)
            | Value::Fields(..)
            | Value::File(..)
            | Value::Files(..)
            | Value::KeyNumber(..)
            | Value::KeyNumbers(..)
            | Value::KeyString(..)
            | Value::KeyStrings(..)
            | Value::String(..)
            | Value::Numbers(..)
            | Value::Strings(..) => None,
        }
    }
}

impl ExtractAs<u8> for &Field {
    fn extract_as(&self) -> Option<u8> {
        match &self.value {
            Value::Number(value) => (*value).try_into().ok(),
            Value::Boolean(..)
            | Value::Directories(..)
            | Value::Directory(..)
            | Value::Fields(..)
            | Value::File(..)
            | Value::Files(..)
            | Value::KeyNumber(..)
            | Value::KeyNumbers(..)
            | Value::KeyString(..)
            | Value::KeyStrings(..)
            | Value::String(..)
            | Value::Numbers(..)
            | Value::Strings(..) => None,
        }
    }
}

impl ExtractAs<u16> for &Field {
    fn extract_as(&self) -> Option<u16> {
        match &self.value {
            Value::Number(value) => (*value).try_into().ok(),
            Value::Boolean(..)
            | Value::Directories(..)
            | Value::Directory(..)
            | Value::Fields(..)
            | Value::File(..)
            | Value::Files(..)
            | Value::KeyNumber(..)
            | Value::KeyNumbers(..)
            | Value::KeyString(..)
            | Value::KeyStrings(..)
            | Value::String(..)
            | Value::Numbers(..)
            | Value::Strings(..) => None,
        }
    }
}

impl ExtractAs<u32> for &Field {
    fn extract_as(&self) -> Option<u32> {
        match &self.value {
            Value::Number(value) => (*value).try_into().ok(),
            Value::Boolean(..)
            | Value::Directories(..)
            | Value::Directory(..)
            | Value::Fields(..)
            | Value::File(..)
            | Value::Files(..)
            | Value::KeyNumber(..)
            | Value::KeyNumbers(..)
            | Value::KeyString(..)
            | Value::KeyStrings(..)
            | Value::String(..)
            | Value::Numbers(..)
            | Value::Strings(..) => None,
        }
    }
}

impl ExtractAs<u64> for &Field {
    fn extract_as(&self) -> Option<u64> {
        match &self.value {
            Value::Number(value) => (*value).try_into().ok(),
            Value::Boolean(..)
            | Value::Directories(..)
            | Value::Directory(..)
            | Value::Fields(..)
            | Value::File(..)
            | Value::Files(..)
            | Value::KeyNumber(..)
            | Value::KeyNumbers(..)
            | Value::KeyString(..)
            | Value::KeyStrings(..)
            | Value::String(..)
            | Value::Numbers(..)
            | Value::Strings(..) => None,
        }
    }
}

impl ExtractAs<usize> for &Field {
    fn extract_as(&self) -> Option<usize> {
        match &self.value {
            Value::Number(value) => (*value).try_into().ok(),
            Value::Boolean(..)
            | Value::Directories(..)
            | Value::Directory(..)
            | Value::Fields(..)
            | Value::File(..)
            | Value::Files(..)
            | Value::KeyNumber(..)
            | Value::KeyNumbers(..)
            | Value::KeyString(..)
            | Value::KeyStrings(..)
            | Value::String(..)
            | Value::Numbers(..)
            | Value::Strings(..) => None,
        }
    }
}

impl ExtractAs<bool> for &Field {
    fn extract_as(&self) -> Option<bool> {
        match &self.value {
            Value::Boolean(value) => Some(*value),
            Value::Number(..)
            | Value::Directories(..)
            | Value::Directory(..)
            | Value::Fields(..)
            | Value::File(..)
            | Value::Files(..)
            | Value::KeyNumber(..)
            | Value::KeyNumbers(..)
            | Value::KeyString(..)
            | Value::KeyStrings(..)
            | Value::String(..)
            | Value::Numbers(..)
            | Value::Strings(..) => None,
        }
    }
}

impl<'l> ExtractAs<&'l Vec<Field>> for &'l Field {
    fn extract_as(&self) -> Option<&'l Vec<Field>> {
        match &self.value {
            Value::Fields(value) => Some(value),
            Value::Number(..)
            | Value::Directories(..)
            | Value::Directory(..)
            | Value::Boolean(..)
            | Value::File(..)
            | Value::Files(..)
            | Value::KeyNumber(..)
            | Value::KeyNumbers(..)
            | Value::KeyString(..)
            | Value::KeyStrings(..)
            | Value::String(..)
            | Value::Numbers(..)
            | Value::Strings(..) => None,
        }
    }
}

impl<'l> ExtractAs<&'l Vec<PathBuf>> for &'l Field {
    fn extract_as(&self) -> Option<&'l Vec<PathBuf>> {
        match &self.value {
            Value::Files(value) => Some(value),
            Value::Number(..)
            | Value::Directories(..)
            | Value::Directory(..)
            | Value::Boolean(..)
            | Value::File(..)
            | Value::Fields(..)
            | Value::KeyNumber(..)
            | Value::KeyNumbers(..)
            | Value::KeyString(..)
            | Value::KeyStrings(..)
            | Value::String(..)
            | Value::Numbers(..)
            | Value::Strings(..) => None,
        }
    }
}

impl<'l> ExtractAs<&'l HashMap<String, Vec<String>>> for &'l Field {
    fn extract_as(&self) -> Option<&'l HashMap<String, Vec<String>>> {
        match &self.value {
            Value::KeyStrings(value) => Some(value),
            Value::Number(..)
            | Value::Directories(..)
            | Value::Directory(..)
            | Value::Boolean(..)
            | Value::File(..)
            | Value::Fields(..)
            | Value::KeyNumber(..)
            | Value::KeyNumbers(..)
            | Value::KeyString(..)
            | Value::Files(..)
            | Value::String(..)
            | Value::Numbers(..)
            | Value::Strings(..) => None,
        }
    }
}
