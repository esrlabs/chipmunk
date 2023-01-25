use super::{map::Map, nature::Nature};
use std::{ops::RangeInclusive, time::Instant};

#[test]
fn test_build() {
    let mut map = Map::new();
    let len: u64 = 1_000_000;
    let mut matches: Vec<u64> = vec![];
    for p in 0..(len - 1) {
        if p % 100 == 0 {
            matches.push(p)
        }
    }

    let start = Instant::now();
    map.insert(&matches, Nature::SEARCH);
    let duration = start.elapsed();
    println!(
        "set initial search matches for stream {len} rows: {} ms",
        duration.as_millis()
    );

    let start = Instant::now();
    map.breadcrumbs_build(4, 2).unwrap();
    let duration = start.elapsed();
    println!("build initial breadcrumbs: {} ms", duration.as_millis());

    let start = Instant::now();
    let mut bookmarks: u64 = 0;
    for p in 0..(len - 1) {
        if p % 1000 == 0 {
            bookmarks += 1;
            map.breadcrumbs_insert_and_update(&vec![p], Nature::BOOKMARK, 4, 2)
                .unwrap();
        }
    }
    let duration = start.elapsed();
    println!(
        "add {bookmarks} bookmarks one by one: {} ms",
        duration.as_millis()
    );

    let start = Instant::now();
    let mut bookmarks: Vec<u64> = vec![];
    for p in 0..(len - 1) {
        if p % 999 == 0 {
            bookmarks.push(p);
        }
    }
    map.breadcrumbs_insert_and_update(&bookmarks, Nature::BOOKMARK, 4, 2)
        .unwrap();
    let duration = start.elapsed();
    println!(
        "add {} bookmarks all together: {} ms",
        bookmarks.len(),
        duration.as_millis()
    );

    let start = Instant::now();
    let mut frames: u64 = 0;
    let available = map.len() as u64;
    for p in 0..(available - 100) {
        if p % 50 == 0 {
            let mut range = RangeInclusive::new(p, p + 100);
            let _frame = map.frame(&mut range).unwrap();
            frames += 1;
        }
    }
    let duration = start.elapsed();
    println!(
        "request {frames} frames (len 100) one by one: {} ms",
        duration.as_millis()
    );
}
