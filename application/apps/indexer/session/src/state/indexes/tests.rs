use super::{map::Map, nature::Nature};
use std::ops::RangeInclusive;

#[test]
fn test_basic() {
    let mut map = Map::new();
    let search_matches = vec![0, 10, 20, 30, 40, 50, 60, 70, 80, 90];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 10);
    // Get frame
    let frame = map.frame(&mut RangeInclusive::new(0, 9)).unwrap();
    assert_eq!(frame.len(), 10);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // Value of Nature::Search is 0, it means sum of all natures should be 0 for frame
    assert_eq!(sum, 0);
    // Add bookmarks into same rows as matches.
    map.insert(&search_matches, &Nature::Bookmark);
    let frame = map.frame(&mut RangeInclusive::new(0, 9)).unwrap();
    assert_eq!(frame.len(), 10);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // As soon as Nature::Bookmark = 1, sum should be 10.
    assert_eq!(sum, 10);
    assert_eq!(map.len(), 10);
    // Remove all bookmarks
    map.remove_range(RangeInclusive::new(0, 90), &Nature::Bookmark);
    assert_eq!(map.len(), 10);
    let frame = map.frame(&mut RangeInclusive::new(0, 9)).unwrap();
    assert_eq!(frame.len(), 10);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // No bookmarks, all indexes has nature Nature::Search = 0, sum should 0 as well
    assert_eq!(sum, 0);
    // Add bookmarks between 0 and 10
    map.insert_range(RangeInclusive::new(1, 9), &Nature::Bookmark);
    assert_eq!(map.len(), 19);
    // This frame should have only 2 matches and 9 bookmarks
    let frame = map.frame(&mut RangeInclusive::new(0, 10)).unwrap();
    assert_eq!(frame.len(), 11);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // 9 bookmarks should give sum = 9
    assert_eq!(sum, 9);
    // First and last elements in frame should be search match only
    assert_eq!(frame.indexes[0].natures[0].as_u8(), 0);
    assert_eq!(frame.indexes[10].natures[0].as_u8(), 0);
    assert_eq!(frame.indexes[0].natures.len(), 1);
    assert_eq!(frame.indexes[10].natures.len(), 1);
    // Select extra 10 rows
    map.insert_range(RangeInclusive::new(91, 100), &Nature::Selection);
    assert_eq!(map.len(), 19 + 10);
    // Will request only selection
    let frame = map.frame(&mut RangeInclusive::new(19, 28)).unwrap();
    assert_eq!(frame.len(), 10);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // 10 selections should give sum = 20 = 2 * 10
    frame.indexes.iter().for_each(|i| {
        assert_eq!(i.natures.len(), 1);
        assert_eq!(i.natures[0].as_u8(), 2);
    });
    assert_eq!(sum, 2 * 10);
    //Remove all search result. Only bookmarks and selections should stay
    map.remove_range(RangeInclusive::new(0, 100), &Nature::Search);
    assert_eq!(map.len(), 19 + 10 - 10);
    // Request all
    let frame = map.frame(&mut RangeInclusive::new(0, 18)).unwrap();
    assert_eq!(frame.len(), 19);
    let sum: u64 = frame
        .indexes
        .iter()
        .map(|i| i.natures.iter().map(|n| n.as_u8() as u64).sum::<u64>())
        .sum();
    // Now we should have 9 bookmarks (+ 9 * 1) and 10 selected rows (+ 2 * 10)
    assert_eq!(sum, 9 + 10 * 2);
}

#[test]
fn test_breadcrumbs_basic() {
    let mut map = Map::new();
    map.set_stream_len(30);
    let search_matches = vec![0, 10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 3);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Search),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (5, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (25, Nature::BreadcrumbSeporator),
        (28, Nature::Breadcrumb),
        (29, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_a() {
    let mut map = Map::new();
    map.set_stream_len(20);
    let search_matches = vec![10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 2);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (4, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_b() {
    let mut map = Map::new();
    map.set_stream_len(20);
    let search_matches = vec![5, 10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 3);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (3, Nature::Breadcrumb),
        (4, Nature::Breadcrumb),
        (5, Nature::Search),
        (6, Nature::Breadcrumb),
        (7, Nature::Breadcrumb),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_c() {
    let mut map = Map::new();
    map.set_stream_len(25);
    let search_matches = vec![5, 10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 3);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (3, Nature::Breadcrumb),
        (4, Nature::Breadcrumb),
        (5, Nature::Search),
        (6, Nature::Breadcrumb),
        (7, Nature::Breadcrumb),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (23, Nature::Breadcrumb),
        (24, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_d() {
    let mut map = Map::new();
    map.set_stream_len(22);
    let search_matches = vec![1, 10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 3);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Search),
        (2, Nature::Breadcrumb),
        (3, Nature::Breadcrumb),
        (5, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_e() {
    let mut map = Map::new();
    map.set_stream_len(21);
    let search_matches = vec![0, 10, 20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 3);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Search),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (5, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_f() {
    let mut map = Map::new();
    map.set_stream_len(20);
    let search_matches = vec![10];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 1);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (4, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_borders_g() {
    let mut map = Map::new();
    map.set_stream_len(20);
    let search_matches = vec![];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 0);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    assert_eq!(map.len(), 0);
}

#[test]
fn test_breadcrumbs_borders_j() {
    let mut map = Map::new();
    map.set_stream_len(20);
    let search_matches = vec![20];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 1);
    // Add into map bookmarks
    map.insert(&vec![10], &Nature::Bookmark);
    assert_eq!(map.len(), 2);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (4, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Bookmark),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_extending_a() {
    let mut map = Map::new();
    map.set_stream_len(51);
    let search_matches = vec![10, 20, 50];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 3);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (4, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (35, Nature::BreadcrumbSeporator),
        (48, Nature::Breadcrumb),
        (49, Nature::Breadcrumb),
        (50, Nature::Search),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // Extend breadcrumbs above
    map.extend_breadcrumbs(35, 10, true).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (4, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (23, Nature::Breadcrumb),
        (24, Nature::Breadcrumb),
        (25, Nature::Breadcrumb),
        (26, Nature::Breadcrumb),
        (27, Nature::Breadcrumb),
        (28, Nature::Breadcrumb),
        (29, Nature::Breadcrumb),
        (30, Nature::Breadcrumb),
        (31, Nature::Breadcrumb),
        (32, Nature::Breadcrumb),
        (35, Nature::BreadcrumbSeporator),
        (48, Nature::Breadcrumb),
        (49, Nature::Breadcrumb),
        (50, Nature::Search),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // Extend all breadcrumbs above
    map.extend_breadcrumbs(35, 10, true).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (4, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (23, Nature::Breadcrumb),
        (24, Nature::Breadcrumb),
        (25, Nature::Breadcrumb),
        (26, Nature::Breadcrumb),
        (27, Nature::Breadcrumb),
        (28, Nature::Breadcrumb),
        (29, Nature::Breadcrumb),
        (30, Nature::Breadcrumb),
        (31, Nature::Breadcrumb),
        (32, Nature::Breadcrumb),
        (33, Nature::Breadcrumb),
        (34, Nature::Breadcrumb),
        (35, Nature::BreadcrumbSeporator),
        (48, Nature::Breadcrumb),
        (49, Nature::Breadcrumb),
        (50, Nature::Search),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // Extend all breadcrumbs after
    map.extend_breadcrumbs(35, 15, false).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (4, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (23, Nature::Breadcrumb),
        (24, Nature::Breadcrumb),
        (25, Nature::Breadcrumb),
        (26, Nature::Breadcrumb),
        (27, Nature::Breadcrumb),
        (28, Nature::Breadcrumb),
        (29, Nature::Breadcrumb),
        (30, Nature::Breadcrumb),
        (31, Nature::Breadcrumb),
        (32, Nature::Breadcrumb),
        (33, Nature::Breadcrumb),
        (34, Nature::Breadcrumb),
        (35, Nature::Breadcrumb),
        (36, Nature::Breadcrumb),
        (37, Nature::Breadcrumb),
        (38, Nature::Breadcrumb),
        (39, Nature::Breadcrumb),
        (40, Nature::Breadcrumb),
        (41, Nature::Breadcrumb),
        (42, Nature::Breadcrumb),
        (43, Nature::Breadcrumb),
        (44, Nature::Breadcrumb),
        (45, Nature::Breadcrumb),
        (46, Nature::Breadcrumb),
        (47, Nature::Breadcrumb),
        (48, Nature::Breadcrumb),
        (49, Nature::Breadcrumb),
        (50, Nature::Search),
    ];
    assert_eq!(control.len(), map.len());
    // map.indexes.iter().for_each(|(n, i)| {
    //     println!("{i:?}");
    // });
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}

#[test]
fn test_breadcrumbs_extending_b() {
    let mut map = Map::new();
    map.set_stream_len(20);
    let search_matches = vec![10];
    // Add into map search matches
    map.insert(&search_matches, &Nature::Search);
    assert_eq!(map.len(), 1);
    // Insert breadcrumbs
    map.insert_breadcrumbs(4, 2).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (4, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // Extend all breadcrumbs on top
    map.extend_breadcrumbs(4, 10, true).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (3, Nature::Breadcrumb),
        (4, Nature::BreadcrumbSeporator),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // Extend all breadcrumbs on top after
    map.extend_breadcrumbs(4, 10, false).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (3, Nature::Breadcrumb),
        (4, Nature::Breadcrumb),
        (5, Nature::Breadcrumb),
        (6, Nature::Breadcrumb),
        (7, Nature::Breadcrumb),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (15, Nature::BreadcrumbSeporator),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // Extend all breadcrumbs on bottom (with invalid offset)
    map.extend_breadcrumbs(15, 100, true).unwrap();
    map.extend_breadcrumbs(15, 100, false).unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Breadcrumb),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (3, Nature::Breadcrumb),
        (4, Nature::Breadcrumb),
        (5, Nature::Breadcrumb),
        (6, Nature::Breadcrumb),
        (7, Nature::Breadcrumb),
        (8, Nature::Breadcrumb),
        (9, Nature::Breadcrumb),
        (10, Nature::Search),
        (11, Nature::Breadcrumb),
        (12, Nature::Breadcrumb),
        (13, Nature::Breadcrumb),
        (14, Nature::Breadcrumb),
        (15, Nature::Breadcrumb),
        (16, Nature::Breadcrumb),
        (17, Nature::Breadcrumb),
        (18, Nature::Breadcrumb),
        (19, Nature::Breadcrumb),
    ];
    assert_eq!(control.len(), map.len());
    // Take whole frame of map
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // Turn off breadcrumbs
    map.remove_range(RangeInclusive::new(0, 19), &Nature::Breadcrumb);
    map.remove_range(RangeInclusive::new(0, 19), &Nature::BreadcrumbSeporator);
    assert_eq!(map.len(), 1);
    let frame = map
        .frame(&mut RangeInclusive::new(0, (map.len() - 1) as u64))
        .unwrap();
    assert_eq!(frame.len(), map.len());
}
