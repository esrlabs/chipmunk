use tokio_util::sync::CancellationToken;

#[derive(Clone, Debug)]
pub struct Signal {
    pub alias: String,
    signal: CancellationToken,
    confirmation: CancellationToken,
}

impl Signal {
    pub fn new(alias: String) -> Signal {
        Signal {
            alias,
            signal: CancellationToken::new(),
            confirmation: CancellationToken::new(),
        }
    }

    pub fn token(&self) -> CancellationToken {
        self.signal.clone()
    }

    pub fn invoke(&self) {
        if self.confirmation.is_cancelled() {
            return;
        }
        if !self.signal.is_cancelled() {
            self.signal.cancel();
        }
    }

    pub async fn cancelled(&self) {
        self.signal.cancelled().await
    }

    pub async fn confirmed(&self) {
        self.confirmation.cancelled().await
    }

    pub fn is_cancelled(&self) -> bool {
        self.confirmation.is_cancelled()
    }

    pub fn is_cancelling(&self) -> bool {
        self.signal.is_cancelled()
    }

    pub fn confirm(&self) {
        if self.confirmation.is_cancelled() {
            return;
        }
        self.confirmation.cancel();
    }
}
