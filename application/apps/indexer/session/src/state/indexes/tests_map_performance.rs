use super::{map::Map, nature::Nature};
use std::{env, ops::RangeInclusive, time::Instant};

#[test]
fn test_build() {
    if env::var("INDEXED_MAP_PERFORMANCE_TEST").is_err() {
        return;
    }
    let mut map = Map::new();
    let len: u64 = 100_000_000;
    let search_trigger = len / 100000;
    let bookmarks_trigger = len / 1997;
    let frames_trigger = len / 200000;
    map.set_stream_len(len, 4, 2, false).unwrap();
    let mut matches: Vec<u64> = vec![];
    for p in 0..(len - 1) {
        if p % search_trigger == 0 {
            matches.push(p)
        }
    }
    let start = Instant::now();
    map.insert(&matches, Nature::SEARCH);
    let duration = start.elapsed();
    println!(
        "[UI: click]....................... 1. set initial search matches (count of matches = {}) for stream {len} rows: {} ms; map len = {}",
        matches.len(),
        duration.as_millis(),
        map.len()
    );

    let start = Instant::now();
    map.breadcrumbs_build(4, 2).unwrap();
    let duration = start.elapsed();
    println!(
        "[UI: click]....................... 2. build initial breadcrumbs: {} ms; map len = {}",
        duration.as_millis(),
        map.len()
    );

    let start = Instant::now();
    let mut bookmarks: u64 = 0;
    for p in 0..(len - 1) {
        if p % bookmarks_trigger == 0 {
            bookmarks += 1;
            map.breadcrumbs_insert_and_update(&[p], Nature::BOOKMARK, 4, 2)
                .unwrap();
        }
    }
    let duration = start.elapsed();
    println!(
        "[UI: click]....................... 3. add {bookmarks} bookmarks one by one: {} ms; (each ~{}ms) map len = {}",
        duration.as_millis(),
        duration.as_millis() as f64 / bookmarks as f64,
        map.len()
    );

    let start = Instant::now();
    let mut bookmarks: Vec<u64> = vec![];
    for p in 0..(len - 1) {
        if p % (bookmarks_trigger + 1) == 0 {
            bookmarks.push(p);
        }
    }
    map.breadcrumbs_insert_and_update(&bookmarks, Nature::BOOKMARK, 4, 2)
        .unwrap();
    let duration = start.elapsed();
    println!(
        "[UI: restore]..................... 4. add {} bookmarks all together: {} ms; map len = {}",
        bookmarks.len(),
        duration.as_millis(),
        map.len()
    );

    let start = Instant::now();
    let mut frames: u64 = 0;
    let available = map.len() as u64;
    for p in 0..(available - 100) {
        if p % frames_trigger == 0 {
            let mut range = RangeInclusive::new(p, p + 100);
            let _frame = map.frame(&mut range).unwrap();
            frames += 1;
        }
    }
    let duration = start.elapsed();
    println!(
        "[UI: scroll without updates]...... 5. request {frames} frames (len 100) one by one: {} ms; (each ~{}ms)",
        duration.as_millis(),
        duration.as_millis() as f64 / frames as f64,
    );

    let start = Instant::now();
    let mut frames: u64 = 0;
    let step: u64 = 1000;
    let mut next_match = *matches.last().unwrap();
    for _ in 0..500 {
        let mut matches: Vec<u64> = vec![];
        for _ in 0..10 {
            next_match += step;
            matches.push(next_match);
        }
        map.set_stream_len(len + next_match + step, 4, 2, true)
            .unwrap();
        map.breadcrumbs_insert_and_update(&matches, Nature::SEARCH, 4, 2)
            .unwrap();
        let mut range = RangeInclusive::new(map.len() as u64 - 200, map.len() as u64 - 100);
        let _frame = map.frame(&mut range).unwrap();
        frames += 1;
    }
    let duration = start.elapsed();
    println!(
        "[UI: scroll without with updates]. 6. request with changes {frames} frames (len 100) one by one: {} ms; (each ~{}ms); stream = {}; map = {}",
        duration.as_millis(),
        duration.as_millis() as f64 / frames as f64,
        map.stream_len,
        map.len()
    );
}
