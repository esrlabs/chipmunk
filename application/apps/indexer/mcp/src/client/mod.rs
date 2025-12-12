use log::{error, warn};

use tokio::{select, sync::mpsc};

use rmcp::{
    RoleClient,
    model::{CallToolRequestParam, ClientInfo, Implementation, InitializeRequestParam},
    service::{RunningService, ServiceExt},
    transport::StreamableHttpClientTransport,
};

use crate::{
    client::{
        conversation::{ChatMessage, ClientToLlm, Conversation, LlmToClient},
        llm::{Llm, LlmClient, LlmConfig},
        messages::{McpChipmunkToClient, McpClientToChipmunk},
    },
    types::McpError,
};

pub mod conversation;
pub mod llm;
pub mod messages;

// TODO:[MCP] store this in a single global location
pub const SERVER_ADDRESS: &str = "http://127.0.0.1:8181/mcp";

pub struct McpConfig {
    pub url: String,
}

pub struct MCPClient {
    chipmunk_to_client_rx: mpsc::Receiver<McpChipmunkToClient>,
    client_to_chipmunk_tx: mpsc::Sender<McpClientToChipmunk>,
    llm_config: LlmConfig,
    mcp_config: McpConfig,
}

impl MCPClient {
    pub fn new(
        mcp_config: McpConfig,
        llm_config: LlmConfig,
    ) -> (
        Self,
        mpsc::Sender<McpChipmunkToClient>,
        mpsc::Receiver<McpClientToChipmunk>,
    ) {
        let (client_to_chipmunk_tx, client_to_chipmunk_rx) = mpsc::channel(32);
        let (chipmunk_to_client_tx, chipmunk_to_client_rx) = mpsc::channel(32);

        (
            Self {
                chipmunk_to_client_rx,
                client_to_chipmunk_tx,
                mcp_config,
                llm_config,
            },
            chipmunk_to_client_tx,
            client_to_chipmunk_rx,
        )
    }

    pub async fn start(self) -> Result<(), McpError> {
        // Setup MCP connection
        let transport = StreamableHttpClientTransport::from_uri(SERVER_ADDRESS);

        // TODO:[MCP] match with MCP server definition
        let client_info = ClientInfo {
            protocol_version: Default::default(),
            capabilities: Default::default(),
            client_info: Implementation {
                name: String::from("mcp-client"),
                title: None,
                version: String::from(env!("CARGO_PKG_VERSION")),
                website_url: None,
                icons: None,
            },
        };

        let mcp_service = client_info
            .serve(transport)
            .await
            .map_err(|e| McpError::Generic {
                message: e.to_string(),
            })?;

        warn!(
            "🟢 MCP client connected to MCP server: {:?}",
            mcp_service.peer_info()
        );

        let tools = mcp_service.list_tools(Default::default()).await?;
        warn!(
            "🟢 Client received available tools from MCP server: {:?}",
            tools
                .tools
                .iter()
                .map(|tool| tool.name.to_string().clone())
                .collect::<Vec<String>>()
        );

        let chipmunk_to_client_rx = self.chipmunk_to_client_rx;
        let chipmunk_response_tx = self.client_to_chipmunk_tx.clone();

        let llm = Llm::from_config(self.llm_config);

        tokio::spawn(async move {
            if let Err(e) = MCPClient::run(
                chipmunk_to_client_rx,
                chipmunk_response_tx,
                mcp_service,
                llm,
            )
            .await
            {
                error!("MCP client event loop ended: {:?}", e);
            }
        });
        warn!("🟢 MCP client started");

        Ok(())
    }

    pub async fn run(
        mut chipmunk_request_rx: mpsc::Receiver<McpChipmunkToClient>,
        chipmunk_response_tx: mpsc::Sender<McpClientToChipmunk>,
        mut mcp_service: RunningService<RoleClient, InitializeRequestParam>,
        llm: Llm<impl LlmClient>,
    ) -> Result<(), McpError> {
        // TODO:[MCP] System prompt probably needs to be tailored to our use case
        // Also this would need to be moved to the below loop, into the initial llm request / system prompt
        let mut conversation = Conversation::new("You are a helpful assistant.".into());
        loop {
            select! {
                Some(chipmunk_request) = chipmunk_request_rx.recv() => {
                    match chipmunk_request {
                        McpChipmunkToClient::UserPrompt { prompt } => {
                            warn!("🟢 MCP Client received mock prompt: {}", prompt);
                            conversation.add_chat_message(ChatMessage::ClientToLlm(ClientToLlm::UserPrompt { content: prompt.clone() }));

                            // Interatively let the LLM client process conversation / last message
                            //  until we get a final response - which would be sent back to chipmunk.
                            loop {
                                match llm.process(&conversation).await? {
                                    LlmToClient::ToolCall { tool_name, arguments } => {

                                        // TODO:[MCP] It seems a bit weird to add the message here.
                                        // Maybe this should be done in the LLM client instead.
                                        // I believe it is important that the message is added,
                                        // since it needs to be part of the converation history, so
                                        // it is visible for the LLM in future prompts/steps.
                                        conversation.add_chat_message(ChatMessage::LlmToClient(LlmToClient::ToolCall {
                                            tool_name: tool_name.clone(),
                                            arguments: arguments.clone(),
                                        }));

                                        let tool_call_param = CallToolRequestParam {
                                            name: tool_name.into(),
                                            arguments,
                                        };

                                        let tool_result = mcp_service
                                            .call_tool(tool_call_param)
                                            .await
                                            .map_err(|e| McpError::Generic {
                                                message: e.to_string(),
                                            })?;

                                        // Same as above, the tool result needs to be part of the
                                        // chat history, so that it is visible for the LLM in future
                                        // prompts/steps.
                                        conversation.add_chat_message(ChatMessage::ClientToLlm(ClientToLlm::ToolResult {
                                            content: tool_result.content,
                                        }));
                                    }
                                    LlmToClient::FinalResponse { content } => {
                                        warn!(" ✅ MCP client received final LLM response: {:?}", content);
                                        // TODO:[MCP] Send final response back to Chipmunk
                                        break;
                                    }
                                    LlmToClient::System { .. } => {
                                        // TODO:[MCP] Do nothing for now
                                    }
                                }
                            }
                        }
                    }
                }
                else => {}
            }
        }

        Ok(())
    }
}
