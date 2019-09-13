#[macro_use]
extern crate neon;
extern crate dlt;
extern crate indexer_base;
extern crate merging;
extern crate processor;
extern crate serde;

use indexer_base::chunks::serialize_chunks;
use indexer_base::config::IndexingConfig;
use neon::prelude::*;
use processor::parse;
use processor::parse::DiscoverItem;
use processor::parse::TimestampFormatResult;
use std::fs;
use std::path;

/// Trys to detect a valid timestamp in a string
/// Returns the a tuple of
/// * the timestamp as posix timestamp
/// * if the year was missing
///   (we assume the current year (local time) if true)
/// * the format string that was used
///
/// # Arguments
///
/// * `input` - A string slice that should be parsed
fn detect_timestamp_in_string(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let input: String = cx.argument::<JsString>(0)?.value();
    match parse::detect_timestamp_in_string(input.as_str(), None) {
        Ok((timestamp, _, _)) => Ok(cx.number((timestamp) as f64)),
        Err(e) => cx.throw_type_error(format!("{}", e)),
    }
}
fn detect_timestamp_format_in_file(mut cx: FunctionContext) -> JsResult<JsValue> {
    let file_name: String = cx.argument::<JsString>(0)?.value();
    let file_path = path::PathBuf::from(&file_name);
    match parse::detect_timestamp_format_in_file(&file_path) {
        Ok(res) => {
            let (min, max) = match parse::timespan_in_file(&res, &file_path) {
                Ok(span) => (
                    Some(parse::posix_timestamp_as_string(span.0)),
                    Some(parse::posix_timestamp_as_string(span.1)),
                ),
                _ => (None, None),
            };
            let timestamp_result = TimestampFormatResult {
                path: file_name.to_string(),
                format: Some(res.clone()),
                min_time: min,
                max_time: max,
            };
            let js_value = neon_serde::to_value(&mut cx, &timestamp_result)?;
            Ok(js_value)
        }
        Err(_) => {
            let timestamp_result = TimestampFormatResult {
                path: file_name.to_string(),
                format: None,
                min_time: None,
                max_time: None,
            };
            let js_value = neon_serde::to_value(&mut cx, &timestamp_result)?;
            Ok(js_value)
        }
    }
}
fn detect_timestamp_formats_in_files(mut cx: FunctionContext) -> JsResult<JsValue> {
    let arg0 = cx.argument::<JsValue>(0)?;

    let items: Vec<DiscoverItem> = neon_serde::from_value(&mut cx, arg0)?;
    println!("received items: {:?}", items);
    let mut results: Vec<TimestampFormatResult> = Vec::new();
    for item in items {
        let file_path = path::PathBuf::from(&item.path);
        match parse::detect_timestamp_format_in_file(&file_path) {
            Ok(res) => {
                let (min, max) = match parse::timespan_in_file(&res, &file_path) {
                    Ok(span) => (
                        Some(parse::posix_timestamp_as_string(span.0)),
                        Some(parse::posix_timestamp_as_string(span.1)),
                    ),
                    _ => (None, None),
                };
                results.push(TimestampFormatResult {
                    path: item.path.to_string(),
                    format: Some(res),
                    min_time: min,
                    max_time: max,
                })
            }
            Err(e) => {
                results.push(TimestampFormatResult {
                    path: item.path.to_string(),
                    format: None,
                    min_time: None,
                    max_time: None,
                });
                eprintln!("executed with error: {}", e)
            }
        }
    }
    let js_value = neon_serde::to_value(&mut cx, &results)?;
    Ok(js_value)
}

fn index_file(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let file = cx.argument::<JsString>(0)?.value();
    let tag = cx.argument::<JsString>(1)?.value();
    let out_path = path::PathBuf::from(cx.argument::<JsString>(2)?.value().as_str());
    let chunk_size = cx.argument::<JsNumber>(3)?.value() as usize;
    let append: bool = cx.argument::<JsBoolean>(4)?.value();
    let stdout: bool = cx.argument::<JsBoolean>(5)?.value();
    let timestamps: bool = cx.argument::<JsBoolean>(6)?.value();
    let status_updates: bool = cx.argument::<JsBoolean>(7)?.value();
    let mapping_out_path: path::PathBuf = path::PathBuf::from(file.to_string() + ".map.json");

    let f = match fs::File::open(&file) {
        Ok(file) => file,
        Err(_) => {
            eprintln!("could not open {}", file);
            std::process::exit(2)
        }
    };

    let source_file_size = match f.metadata() {
        Ok(file_meta) => file_meta.len() as usize,
        Err(_) => {
            eprintln!("could not find out size of source file");
            std::process::exit(2);
        }
    };

    match processor::processor::create_index_and_mapping(
        IndexingConfig {
            tag: tag.as_str(),
            chunk_size,
            in_file: f,
            out_path: &out_path,
            append,
            source_file_size,
            to_stdout: stdout,
            status_updates,
        },
        timestamps,
    ) {
        Err(why) => {
            eprintln!("couldn't process: {}", why);
            std::process::exit(2)
        }
        Ok(chunks) => {
            let _ = serialize_chunks(&chunks, &mapping_out_path);
            Ok(cx.boolean(true))
        }
    }
}

fn merge_files(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let merge_config_file_name = cx.argument::<JsString>(0)?.value();
    let out_path = path::PathBuf::from(cx.argument::<JsString>(1)?.value().as_str());
    let chunk_size = cx.argument::<JsNumber>(2)?.value() as usize;
    let append: bool = cx.argument::<JsBoolean>(3)?.value();
    let stdout: bool = cx.argument::<JsBoolean>(4)?.value();
    let status_updates: bool = cx.argument::<JsBoolean>(5)?.value();
    let merger = merging::merger::Merger {
        chunk_size, // used for mapping line numbers to byte positions
    };
    let config_path = path::PathBuf::from(merge_config_file_name);
    let merged_lines = match merger.merge_files_use_config_file(
        &config_path,
        &out_path,
        append,
        stdout,
        status_updates,
    ) {
        Ok(cnt) => cnt,
        Err(e) => {
            eprintln!("error merging: {}", e);
            std::process::exit(2)
        }
    };
    Ok(cx.number(merged_lines as f64))
}
fn concat_files(mut cx: FunctionContext) -> JsResult<JsNumber> {
    let concat_config_file_name = cx.argument::<JsString>(0)?.value();
    let out_path = path::PathBuf::from(cx.argument::<JsString>(1)?.value().as_str());
    let chunk_size = cx.argument::<JsNumber>(2)?.value() as usize;
    let append: bool = cx.argument::<JsBoolean>(3)?.value();
    let stdout: bool = cx.argument::<JsBoolean>(4)?.value();
    let status_updates: bool = cx.argument::<JsBoolean>(5)?.value();
    let concatenator = merging::concatenator::Concatenator {
        chunk_size, // used for mapping line numbers to byte positions
    };
    let config_path = path::PathBuf::from(concat_config_file_name);
    let concatenated_lines = match concatenator.concat_files_use_config_file(
        &config_path,
        &out_path,
        append,
        stdout,
        status_updates,
    ) {
        Ok(cnt) => cnt,
        Err(e) => {
            eprintln!("error merging: {}", e);
            std::process::exit(2)
        }
    };
    Ok(cx.number(concatenated_lines as f64))
}
fn index_dlt_file(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let file_name = cx.argument::<JsString>(0)?.value();
    let tag = cx.argument::<JsString>(1)?.value();
    let out_path = path::PathBuf::from(cx.argument::<JsString>(2)?.value().as_str());
    let chunk_size = cx.argument::<JsNumber>(3)?.value() as usize;
    let append: bool = cx.argument::<JsBoolean>(4)?.value();
    let stdout: bool = cx.argument::<JsBoolean>(5)?.value();
    let status_updates: bool = cx.argument::<JsBoolean>(6)?.value();

    let args_length = cx.len();
    let filter_conf: Option<dlt::filtering::DltFilterConfig> = if args_length == 8 {
        let conf_arg = cx.argument::<JsValue>(7)?;
        Some(neon_serde::from_value(&mut cx, conf_arg)?)
    } else {
        None
    };
    println!("filter-conf used: {:?}", filter_conf);

    let mapping_out_path: path::PathBuf = path::PathBuf::from(file_name.to_string() + ".map.json");
    let source_file_size = match fs::metadata(&file_name) {
        Ok(file_meta) => file_meta.len() as usize,
        Err(_) => {
            eprintln!("could not find out size of source file");
            std::process::exit(2);
        }
    };
    let file_path = path::PathBuf::from(&file_name);
    let f = match fs::File::open(&file_path) {
        Ok(file) => file,
        Err(_) => {
            eprintln!("could not open {:?}", file_path);
            std::process::exit(2)
        }
    };

    match dlt::dlt_parse::create_index_and_mapping_dlt(
        IndexingConfig {
            tag: tag.as_str(),
            chunk_size,
            in_file: f,
            out_path: &out_path,
            append,
            source_file_size,
            to_stdout: stdout,
            status_updates,
        },
        filter_conf,
    ) {
        Err(why) => {
            eprintln!("couldn't process: {}", why);
            std::process::exit(2)
        }
        Ok(chunks) => {
            let _ = serialize_chunks(&chunks, &mapping_out_path);
            Ok(cx.boolean(true))
        }
    }
}
fn dlt_stats(mut cx: FunctionContext) -> JsResult<JsValue> {
    let file_name = cx.argument::<JsString>(0)?.value();
    let file_path = path::PathBuf::from(file_name);
    let f = match fs::File::open(&file_path) {
        Ok(file) => file,
        Err(_) => {
            eprintln!("could not open {:?}", file_path);
            std::process::exit(2)
        }
    };
    match dlt::dlt_parse::get_dlt_file_info(&f) {
        Err(why) => {
            eprintln!("couldn't collect statistics: {}", why);
            std::process::exit(2)
        }
        Ok(res) => {
            let js_value = neon_serde::to_value(&mut cx, &res)?;
            Ok(js_value)
        }
    }
}

register_module!(mut cx, {
    // handle_discover_subcommand
    cx.export_function("detectTimestampInString", detect_timestamp_in_string)?;
    cx.export_function(
        "detectTimestampFormatInFile",
        detect_timestamp_format_in_file,
    )?;
    cx.export_function(
        "detectTimestampFormatsInFiles",
        detect_timestamp_formats_in_files,
    )?;
    cx.export_function("indexFile", index_file)?;
    cx.export_function("mergeFiles", merge_files)?;
    cx.export_function("concatFiles", concat_files)?;
    cx.export_function("indexDltFile", index_dlt_file)?;
    cx.export_function("dltStats", dlt_stats)?;
    Ok(())
});
