use std::ops::RangeInclusive;

use super::{map::Map, nature::Nature};

fn overlap() -> Nature {
    let mut nature = Nature::SEARCH;
    nature.include(Nature::BOOKMARK);
    nature
}

fn element(pos: usize) -> stypes::GrabbedElement {
    stypes::GrabbedElement {
        source_id: 0,
        content: String::new(),
        pos,
        nature: 0,
    }
}

#[test]
fn frame_preserves_order_nature_alignment_and_non_contiguous_ranges() {
    let mut map = Map::new();
    map.insert([10, 2], Nature::SEARCH);
    map.insert([7, 10], Nature::BOOKMARK);

    let frame = map.frame(&mut (0..=2)).unwrap();

    assert_eq!(
        frame.indexes,
        vec![(2, Nature::SEARCH), (7, Nature::BOOKMARK), (10, overlap()),]
    );
    assert_eq!(
        frame.ranges(),
        vec![
            RangeInclusive::new(2, 2),
            RangeInclusive::new(7, 7),
            RangeInclusive::new(10, 10),
        ]
    );

    let mut elements = [element(2), element(7), element(10)];
    frame.set_elements_nature(&mut elements).unwrap();
    assert_eq!(
        elements.map(|element| element.nature),
        [
            Nature::SEARCH.bits(),
            Nature::BOOKMARK.bits(),
            overlap().bits(),
        ]
    );
}

#[test]
fn indexed_export_ranges_compact_contiguous_session_positions() {
    let mut map = Map::new();
    map.insert([8, 3, 4, 5, 10, 11], Nature::SEARCH);
    map.frame(&mut (0..=5)).unwrap();

    assert_eq!(
        map.get_all_as_ranges(),
        vec![
            RangeInclusive::new(3, 5),
            RangeInclusive::new(8, 8),
            RangeInclusive::new(10, 11),
        ]
    );
}

#[test]
fn empty_and_out_of_range_frames_are_rejected() {
    let mut map = Map::new();
    assert!(map.frame(&mut (0..=0)).is_err());

    map.insert([4, 9], Nature::SEARCH);
    assert!(map.frame(&mut (0..=2)).is_err());
}

#[test]
fn naturalize_marks_indexed_rows_and_leaves_other_rows_unchanged() {
    let mut map = Map::new();
    map.insert([2], Nature::SEARCH);
    map.insert([2], Nature::BOOKMARK);
    let mut elements = [element(1), element(2), element(3)];

    map.naturalize(&mut elements);

    assert_eq!(elements[0].nature, 0);
    assert_eq!(elements[1].nature, overlap().bits());
    assert_eq!(elements[2].nature, 0);
}
