use super::{
    controller::{Controller, Mode},
    map::Map,
    nature::Nature,
};
use processor::map::FilterMatch;
use std::ops::RangeInclusive;

fn get_matches(indexes: Vec<u64>) -> Vec<FilterMatch> {
    indexes
        .iter()
        .map(|i| FilterMatch {
            index: *i,
            filters: vec![0],
        })
        .collect::<Vec<FilterMatch>>()
}
#[test]
fn test_a() {
    let mut controller = Controller::new(None);
    controller.set_stream_len(30).unwrap();
    let search_matches = get_matches(vec![0, 10, 20, 30]);
    controller.append_search_results(&search_matches).unwrap();
    assert_eq!(controller.len(), search_matches.len());
    let frame = controller
        .frame(&mut RangeInclusive::new(0, (controller.len() - 1) as u64))
        .unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Search),
        (10, Nature::Search),
        (20, Nature::Search),
        (30, Nature::Search),
    ];
    assert_eq!(frame.len(), control.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    controller.set_mode(Mode::Breadcrumbs).unwrap();
    let frame = controller
        .frame(&mut RangeInclusive::new(0, (controller.len() - 1) as u64))
        .unwrap();
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
        (30, Nature::Search),
    ];
    assert_eq!(frame.len(), control.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // Increase stream len
    controller.set_stream_len(40).unwrap();
    let frame = controller
        .frame(&mut RangeInclusive::new(0, (controller.len() - 1) as u64))
        .unwrap();
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
        (30, Nature::Search),
        (31, Nature::Breadcrumb),
        (32, Nature::Breadcrumb),
        (35, Nature::BreadcrumbSeporator),
        (38, Nature::Breadcrumb),
        (39, Nature::Breadcrumb),
    ];
    assert_eq!(frame.len(), control.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // Extend bookmarks
    controller.extend_breadcrumbs(5, 2, true).unwrap();
    let frame = controller
        .frame(&mut RangeInclusive::new(0, (controller.len() - 1) as u64))
        .unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Search),
        (1, Nature::Breadcrumb),
        (2, Nature::Breadcrumb),
        (3, Nature::Breadcrumb),
        (4, Nature::Breadcrumb),
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
        (30, Nature::Search),
        (31, Nature::Breadcrumb),
        (32, Nature::Breadcrumb),
        (35, Nature::BreadcrumbSeporator),
        (38, Nature::Breadcrumb),
        (39, Nature::Breadcrumb),
    ];
    assert_eq!(frame.len(), control.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // Extend bookmarks
    controller.extend_breadcrumbs(5, 2, false).unwrap();
    let frame = controller
        .frame(&mut RangeInclusive::new(0, (controller.len() - 1) as u64))
        .unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Search),
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
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (25, Nature::BreadcrumbSeporator),
        (28, Nature::Breadcrumb),
        (29, Nature::Breadcrumb),
        (30, Nature::Search),
        (31, Nature::Breadcrumb),
        (32, Nature::Breadcrumb),
        (35, Nature::BreadcrumbSeporator),
        (38, Nature::Breadcrumb),
        (39, Nature::Breadcrumb),
    ];
    assert_eq!(frame.len(), control.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    // Increase stream len
    controller.set_stream_len(100).unwrap();
    let frame = controller
        .frame(&mut RangeInclusive::new(0, (controller.len() - 1) as u64))
        .unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Search),
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
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (25, Nature::BreadcrumbSeporator),
        (28, Nature::Breadcrumb),
        (29, Nature::Breadcrumb),
        (30, Nature::Search),
        (31, Nature::Breadcrumb),
        (32, Nature::Breadcrumb),
        (65, Nature::BreadcrumbSeporator),
        (98, Nature::Breadcrumb),
        (99, Nature::Breadcrumb),
    ];
    assert_eq!(frame.len(), control.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
    //Add search
    controller
        .append_search_results(&get_matches(vec![97, 98]))
        .unwrap();
    let frame = controller
        .frame(&mut RangeInclusive::new(0, (controller.len() - 1) as u64))
        .unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Search),
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
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (25, Nature::BreadcrumbSeporator),
        (28, Nature::Breadcrumb),
        (29, Nature::Breadcrumb),
        (30, Nature::Search),
        (31, Nature::Breadcrumb),
        (32, Nature::Breadcrumb),
        (63, Nature::BreadcrumbSeporator),
        (95, Nature::Breadcrumb),
        (96, Nature::Breadcrumb),
        (97, Nature::Search),
        (98, Nature::Search),
        (99, Nature::Breadcrumb),
    ];
    assert_eq!(frame.len(), control.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });

    //Add search & Increase stream len
    controller.set_stream_len(120).unwrap();
    controller
        .append_search_results(&get_matches(vec![101, 105, 111]))
        .unwrap();
    let frame = controller
        .frame(&mut RangeInclusive::new(0, (controller.len() - 1) as u64))
        .unwrap();
    // We are expecting to see next "picture"
    let control: Vec<(u64, Nature)> = vec![
        (0, Nature::Search),
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
        (20, Nature::Search),
        (21, Nature::Breadcrumb),
        (22, Nature::Breadcrumb),
        (25, Nature::BreadcrumbSeporator),
        (28, Nature::Breadcrumb),
        (29, Nature::Breadcrumb),
        (30, Nature::Search),
        (31, Nature::Breadcrumb),
        (32, Nature::Breadcrumb),
        (63, Nature::BreadcrumbSeporator),
        (95, Nature::Breadcrumb),
        (96, Nature::Breadcrumb),
        (97, Nature::Search),
        (98, Nature::Search),
        (99, Nature::Breadcrumb),
        (100, Nature::Breadcrumb),
        (101, Nature::Search),
        (102, Nature::Breadcrumb),
        (103, Nature::Breadcrumb),
        (104, Nature::Breadcrumb),
        (105, Nature::Search),
        (106, Nature::Breadcrumb),
        (107, Nature::Breadcrumb),
        (108, Nature::Breadcrumb),
        (109, Nature::Breadcrumb),
        (110, Nature::Breadcrumb),
        (111, Nature::Search),
        (112, Nature::Breadcrumb),
        (113, Nature::Breadcrumb),
        (115, Nature::BreadcrumbSeporator),
        (118, Nature::Breadcrumb),
        (119, Nature::Breadcrumb),
    ];
    assert_eq!(frame.len(), control.len());
    frame.indexes.iter().enumerate().for_each(|(n, i)| {
        let (pos, nature) = control.get(n).unwrap();
        assert_eq!(*pos, i.position);
        assert_eq!(*nature, *i.natures.first().unwrap());
    });
}
