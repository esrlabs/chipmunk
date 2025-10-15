pub fn setup() -> anyhow::Result<()> {
    // Use env logger while in development.
    env_logger::init();

    Ok(())
}
