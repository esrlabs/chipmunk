mod ai_config;
mod parameters;
mod tasks;
mod tools;
mod utils;

use anyhow::Result;
use rmcp::{
    handler::server::{ServerHandler, router::tool::ToolRouter},
    model::{ServerCapabilities, ServerInfo},
    tool_handler,
};
use tokio::sync::mpsc::{Receiver, Sender};

use ai_config::AiConfig;
use tasks::Task;

/// ChipmunkAI is responsible for receiving the prompt from the UI and the processing
/// the prompt with the LLM agent. If agent invokes some tool then
pub struct ChipmunkAI {
    pub config: AiConfig,

    // Channel for sending the Task to Chipmunk Core
    pub task_tx: Sender<Task>,

    //Channel for receiving the prompt from the User
    pub prompt_rx: Receiver<String>,

    // Channel for sending the UI updates to Chipmunk Core.
    // This channel will receive the updated from AI agent,
    // e.g. UI messages to display, thinking..., Searching for tools...
    pub ui_tx: Sender<String>,

    pub tool_router: ToolRouter<Self>,
}

#[tool_handler]
impl ServerHandler for ChipmunkAI {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some("Chipmunk AI".to_string()),
            capabilities: ServerCapabilities::builder()
                .enable_tools()
                .enable_prompts()
                .enable_resources()
                .build(),
            ..Default::default()
        }
    }
}

/// ServerCommunication is responsible to receiving the tasks from
/// AI. Once task is received then Chipmunk takes the necessary action on the tasks,
/// apply those tasks to the UI.
pub struct ServerCommunication {
    pub task_rx: Receiver<Task>,
}

impl ServerCommunication {
    pub fn new(task_rx: Receiver<Task>) -> Self {
        Self { task_rx }
    }
}

/// ClientCommuinication is responsible for communicating the tasks from
/// UI to the AI agent. With this user can send the prompt to AI agent and
/// AI agent can send the response over mpsc receiver to render on the UI
pub struct ClientCommunication {
    pub ui_rx: Receiver<String>,
    pub prompt_tx: Sender<String>,
}

impl ClientCommunication {
    pub fn new(ui_receiver: Receiver<String>, prompt_sender: Sender<String>) -> Self {
        Self {
            ui_rx: ui_receiver,
            prompt_tx: prompt_sender,
        }
    }
}

pub fn start() -> Result<(ChipmunkAI, ServerCommunication, ClientCommunication)> {
    let (task_tx, task_rx) = tokio::sync::mpsc::channel::<Task>(10);
    let (prompt_tx, prompt_rx) = tokio::sync::mpsc::channel::<String>(1);
    let (ui_tx, ui_rx) = tokio::sync::mpsc::channel::<String>(1);

    let server_comm = ServerCommunication::new(task_rx);
    let client_comm = ClientCommunication::new(ui_rx, prompt_tx);

    let config = AiConfig::default();
    let manager = ChipmunkAI::new(config, prompt_rx, task_tx, ui_tx);

    Ok((manager, server_comm, client_comm))
}
