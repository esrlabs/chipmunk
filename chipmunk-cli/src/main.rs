use chipmunk_cli::run_app;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    run_app().await
}
