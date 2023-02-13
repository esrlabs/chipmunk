use crate::search::searchers;
use std::{
    collections::HashMap,
    io::{Error, ErrorKind, Write},
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use super::values::ValueSearchHolder;

// create tmp file with content, apply search
fn extracted(
    content: &str,
    filters: Vec<String>,
) -> Result<HashMap<u64, Vec<(u8, String)>>, std::io::Error> {
    let mut tmp_file = tempfile::NamedTempFile::new()?;
    let input_file = tmp_file.as_file_mut();
    input_file.write_all(content.as_bytes())?;
    let file_size = input_file.metadata()?.len();
    let mut holder = ValueSearchHolder::new(tmp_file.path(), Uuid::new_v4(), 0, 0);
    holder
        .set_filters(filters.clone())
        .expect("set_filters failed");
    let (_range, values) = searchers::values::execute_fresh_value_search(
        &mut holder,
        filters,
        0,
        file_size,
        CancellationToken::new(),
    )
    .map_err(|e| Error::new(ErrorKind::Other, format!("Error in search: {e}")))?;
    Ok(values)
}

#[test]
fn test_value_search() -> Result<(), std::io::Error> {
    let mut sum: usize = 0;
    let mut rows: Vec<String> = vec![];
    for n in 0..100 {
        rows.push(if n % 10 == 0 {
            sum += n;
            format!("{n} test log entry CPU={n}%; some content")
        } else {
            format!("{n} test log entry; some content")
        });
    }
    let values = extracted(&rows.join("\n"), vec![String::from("CPU=(\\d{2,})")])?;
    let mut control: usize = 0;
    values.iter().for_each(|(pos, values)| {
        assert_eq!(1, values.len());
        let (_term, value) = &values[0];
        let value = value.parse::<usize>().unwrap();
        control += value;
        assert_eq!(*pos as usize, value);
    });
    assert_eq!(control, sum);
    Ok(())
}

#[test]
fn test_value_search2() -> Result<(), std::io::Error> {
    let mut sum_0: usize = 0;
    let mut sum_1: usize = 0;
    let mut rows: Vec<String> = vec![];
    for n in 0..100 {
        rows.push(if n % 10 == 0 {
            sum_0 += n;
            sum_1 += n;
            format!("{n} test log entry CPU={n}%; TEMP={n}C some content")
        } else if n % 5 == 0 {
            sum_1 += n;
            format!("{n} test log entry TEMP={n}C some content")
        } else {
            format!("{n} test log entry; some content")
        });
    }
    let values = extracted(
        &rows.join("\n"),
        vec![
            String::from("CPU=(\\d{1,})%"),
            String::from("TEMP=(\\d{1,})C"),
        ],
    )?;
    let mut control_0: usize = 0;
    let mut control_1: usize = 0;
    values.iter().for_each(|(pos, values)| {
        assert!(!values.is_empty());
        for (term, value) in values.iter() {
            if *term == 0 {
                control_0 += value.parse::<usize>().unwrap();
            } else if *term == 1 {
                control_1 += value.parse::<usize>().unwrap();
            }
            assert_eq!(*pos as usize, value.parse::<usize>().unwrap());
        }
    });
    assert_eq!(control_0, sum_0);
    assert_eq!(control_1, sum_1);
    Ok(())
}
