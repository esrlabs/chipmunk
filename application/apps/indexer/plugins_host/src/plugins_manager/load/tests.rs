use super::*;

//TODO AAZ: Write meaningful tests for loading to ensure loading can't fail because of
//misconfigured plugins in any case.
#[tokio::test]
#[ignore]
async fn prototype_load() {
    let plugins = load_plugins().await;
    dbg!(&plugins);

    panic!("This test is for debugging purpose only");
}
