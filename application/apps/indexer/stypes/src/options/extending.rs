use crate::*;

pub trait ExtractByKey<T> {
    fn extract_by_key(&self, key: &str) -> Option<T>;
}

impl ExtractByKey<String> for &[Field] {
    fn extract_by_key(&self, key: &str) -> Option<String> {
        self.iter()
            .find(|field| field.id == key)
            .map(|field| match &field.value {
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
            })
            .flatten()
    }
}

impl ExtractByKey<i64> for &[Field] {
    fn extract_by_key(&self, key: &str) -> Option<i64> {
        self.iter()
            .find(|field| field.id == key)
            .map(|field| match &field.value {
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
            })
            .flatten()
    }
}

impl ExtractByKey<u8> for &[Field] {
    fn extract_by_key(&self, key: &str) -> Option<u8> {
        self.iter()
            .find(|field| field.id == key)
            .map(|field| match &field.value {
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
            })
            .flatten()
    }
}

impl ExtractByKey<u16> for &[Field] {
    fn extract_by_key(&self, key: &str) -> Option<u16> {
        self.iter()
            .find(|field| field.id == key)
            .map(|field| match &field.value {
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
            })
            .flatten()
    }
}

impl ExtractByKey<u32> for &[Field] {
    fn extract_by_key(&self, key: &str) -> Option<u32> {
        self.iter()
            .find(|field| field.id == key)
            .map(|field| match &field.value {
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
            })
            .flatten()
    }
}

impl ExtractByKey<u64> for &[Field] {
    fn extract_by_key(&self, key: &str) -> Option<u64> {
        self.iter()
            .find(|field| field.id == key)
            .map(|field| match &field.value {
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
            })
            .flatten()
    }
}

impl ExtractByKey<usize> for &[Field] {
    fn extract_by_key(&self, key: &str) -> Option<usize> {
        self.iter()
            .find(|field| field.id == key)
            .map(|field| match &field.value {
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
            })
            .flatten()
    }
}

impl ExtractByKey<bool> for &[Field] {
    fn extract_by_key(&self, key: &str) -> Option<bool> {
        self.iter()
            .find(|field| field.id == key)
            .map(|field| match &field.value {
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
            })
            .flatten()
    }
}
