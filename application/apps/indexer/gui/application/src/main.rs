#[tokio::main]
async fn main() -> anyhow::Result<()> {
    application::run_app().await
}
