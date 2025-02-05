use tokio::signal;
use tokio_util::sync::CancellationToken;

use chipmunk_cli::run_app;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cancel_token = CancellationToken::new();

    // Listen on cancel events on a separate task.
    tokio::spawn(cancel_listener(cancel_token.clone()));

    // Run main app on the current task.
    run_app(cancel_token).await
}

/// Sends cancel signal when when receiving Ctrl_c once, then forcing
/// shutting down the application in case of receiving another cancel signal
/// while gracefully shutting down.
async fn cancel_listener(cancel_token: CancellationToken) {
    let mut cancel_count = 0;
    loop {
        match signal::ctrl_c().await {
            Ok(()) => {
                if cancel_count == 0 {
                    println!("Shutting down...");
                    cancel_token.cancel();
                } else {
                    eprintln!("Forcing the program to exit...");
                    std::process::exit(1)
                }
                cancel_count += 1;
            }
            Err(err) => {
                eprintln!("Unable to listen for shutdown signal: {}", err);
                std::process::exit(1)
            }
        }
    }
}
