use node_bindgen::derive::node_bindgen;
use tokio_serial::available_ports;

#[node_bindgen]
struct Serial {}

#[node_bindgen]
impl Serial {
    #[node_bindgen(constructor)]
    fn new() -> Self {
        Serial {}
    }
    #[node_bindgen]
    async fn ports(&self) -> Result<Vec<String>, String> {
        match available_ports() {
            Ok(ports) => Ok(ports.into_iter().map(|p| p.port_name).collect()),
            Err(err) => Err(err.to_string()),
        }
    }
}
