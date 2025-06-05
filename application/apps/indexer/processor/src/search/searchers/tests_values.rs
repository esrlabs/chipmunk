use crate::search::{
    searchers,
    searchers::{BaseSearcher, values::ValueSearchState},
};
use std::{
    collections::HashMap,
    io::{Error, Write},
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use super::values::ValueSearchHolder;

// create tmp file with content, apply search
fn extracted(
    content: &str,
    filters: Vec<String>,
) -> Result<HashMap<u8, Vec<(u64, f64)>>, std::io::Error> {
    let mut tmp_file = tempfile::NamedTempFile::new()?;
    let input_file = tmp_file.as_file_mut();
    input_file.write_all(content.as_bytes())?;
    let file_size = input_file.metadata()?.len();
    let mut holder: BaseSearcher<ValueSearchState> =
        ValueSearchHolder::new(tmp_file.path(), Uuid::new_v4(), 0, 0);
    holder.setup(filters).expect("set_filters failed");
    let (_range, values) =
        searchers::values::search(&mut holder, 0, file_size, CancellationToken::new())
            .map_err(|e| Error::other(format!("Error in search: {e}")))?;
    Ok(values)
}

#[test]
fn test_value_search() -> Result<(), std::io::Error> {
    let mut sum: f64 = 0.0;
    let mut rows: Vec<String> = vec![];
    for n in 0..100 {
        rows.push(if n % 10 == 0 {
            sum += n as f64;
            format!("{n} test log entry CPU={n}%; some content")
        } else {
            format!("{n} test log entry; some content")
        });
    }
    let terms = extracted(&rows.join("\n"), vec![String::from("CPU=(\\d{2,})")])?;
    let mut control: f64 = 0f64;
    assert_eq!(1, terms.len());
    terms.iter().for_each(|(_term, values)| {
        values.iter().for_each(|(pos, value)| {
            control += value;
            assert_eq!(*pos as f64, *value);
        });
    });
    assert_eq!(control, sum);
    Ok(())
}

#[test]
fn test_value_search2() -> Result<(), std::io::Error> {
    let mut sum_0: f64 = 0f64;
    let mut sum_1: f64 = 0f64;
    let mut rows: Vec<String> = vec![];
    for n in 0..100 {
        rows.push(if n % 10 == 0 {
            sum_0 += n as f64;
            sum_1 += n as f64;
            format!("{n} test log entry CPU={n}%; TEMP={n}C some content")
        } else if n % 5 == 0 {
            sum_1 += n as f64;
            format!("{n} test log entry TEMP={n}C some content")
        } else {
            format!("{n} test log entry; some content")
        });
    }
    let terms = extracted(
        &rows.join("\n"),
        vec![
            String::from("CPU=(\\d{1,})%"),
            String::from("TEMP=(\\d{1,})C"),
        ],
    )?;
    let mut control_0: f64 = 0f64;
    let mut control_1: f64 = 0f64;
    terms.iter().for_each(|(term, values)| {
        assert!(!values.is_empty());
        for (pos, value) in values.iter() {
            if *term == 0 {
                control_0 += value;
            } else if *term == 1 {
                control_1 += value;
            }
            assert_eq!(*pos as f64, *value);
        }
    });
    assert_eq!(control_0, sum_0);
    assert_eq!(control_1, sum_1);
    Ok(())
}
