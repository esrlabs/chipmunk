use log::{debug, error};
use node_bindgen::{core::buffer::JSArrayBuffer, derive::node_bindgen};
use session::components::ComponentsSession;
use std::{str::FromStr, thread};
use tokio::{runtime::Runtime, sync::oneshot};
use uuid::Uuid;

struct Components {
    session: Option<ComponentsSession>,
}

#[node_bindgen]
impl Components {
    #[node_bindgen(constructor)]
    pub fn new() -> Self {
        Self { session: None }
    }

    #[node_bindgen(mt)]
    async fn init<F: Fn(stypes::CallbackOptionsEvent) + Send + 'static>(
        &mut self,
        callback: F,
    ) -> Result<(), stypes::ComputationError> {
        let rt = Runtime::new().map_err(|e| {
            stypes::ComputationError::Process(format!("Could not start tokio runtime: {e}"))
        })?;
        let (tx_session, rx_session) = oneshot::channel();
        thread::spawn(move || {
            rt.block_on(async {
                match ComponentsSession::new().await {
                    Ok((session, mut rx_callback_events)) => {
                        if tx_session.send(Some(session)).is_err() {
                            error!("Cannot setup session instance");
                            return;
                        }
                        debug!("task is started");
                        while let Some(event) = rx_callback_events.recv().await {
                            callback(event)
                        }
                        debug!("sending Destroyed event");
                        callback(stypes::CallbackOptionsEvent::Destroyed);
                        debug!("task is finished");
                    }
                    Err(e) => {
                        error!("Cannot create session instance: {e:?}");
                        if tx_session.send(None).is_err() {
                            error!("Cannot setup session instance");
                        }
                    }
                }
            })
        });
        self.session = rx_session.await.map_err(|_| {
            stypes::ComputationError::Communication(String::from(
                "Fail to get session instance to setup",
            ))
        })?;
        Ok(())
    }

    #[node_bindgen]
    async fn get_components(
        &self,
        origin: JSArrayBuffer,
        ty: JSArrayBuffer,
    ) -> Result<stypes::IdentList, stypes::ComputationError> {
        let ty = stypes::ComponentType::decode(&ty).map_err(stypes::ComputationError::Decoding)?;
        let origin =
            stypes::SourceOrigin::decode(&origin).map_err(stypes::ComputationError::Decoding)?;
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        session
            .get_components(origin, ty)
            .await
            .map(|idents| idents.into())
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    async fn get_options(
        &self,
        origin: JSArrayBuffer,
        targets: Vec<String>,
    ) -> Result<stypes::ComponentsOptionsList, stypes::ComputationError> {
        let targets: Vec<Uuid> = targets
            .into_iter()
            .map(|uuid| Uuid::from_str(&uuid).map_err(|_| stypes::ComputationError::InvalidData))
            .collect::<Result<_, _>>()?;
        let origin =
            stypes::SourceOrigin::decode(&origin).map_err(stypes::ComputationError::Decoding)?;
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        session
            .get_options(targets, origin)
            .await
            .map_err(stypes::ComputationError::NativeError)
    }

    #[node_bindgen]
    fn abort(&self, fields: Vec<String>) -> Result<(), stypes::ComputationError> {
        let session = self
            .session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?;
        session
            .abort(fields)
            .map_err(stypes::ComputationError::NativeError)?;
        Ok(())
    }

    #[node_bindgen]
    async fn destroy(&self) -> Result<(), stypes::ComputationError> {
        self.session
            .as_ref()
            .ok_or(stypes::ComputationError::SessionUnavailable)?
            .shutdown()
            .await
            .map_err(stypes::ComputationError::NativeError)
    }
}
