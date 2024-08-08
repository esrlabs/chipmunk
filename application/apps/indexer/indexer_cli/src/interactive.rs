use crate::{duration_report, Instant};
use futures::{pin_mut, stream::StreamExt};
use parsers::{dlt::DltParser, MessageStreamItem, ParseYield};
use processor::grabber::LineRange;
use rustyline::{error::ReadlineError, DefaultEditor};
use session::session::Session;
use sources::{
    factory::{DltParserSettings, FileFormat, ObserveOptions, ParserType},
    plugins::PluginParserSettings,
    producer::MessageProducer,
    socket::udp::UdpSource,
};
use std::path::PathBuf;
use tokio_util::sync::CancellationToken;

use tokio::{select, sync::mpsc, task, task::JoinHandle};

use uuid::Uuid;

pub(crate) async fn handle_interactive_session(input: Option<PathBuf>) {
    let uuid = Uuid::new_v4();
    // let (tx, _rx) = mpsc::unbounded_channel();
    let (session, mut receiver) = Session::new(uuid).await.expect("Session should be created");
    let (tx, mut rx) = mpsc::unbounded_channel();
    let cancel = CancellationToken::new();

    collect_user_input(tx).await;
    let mut start = Instant::now();
    loop {
        select! {
            command = rx.recv() => {
                match command {
                    Some(Command::Help) => {
                        println!("supported commands are:");
                        println!("  observe -> start observing the file that has been given as input");
                        println!("  dlt -> start observing the dlt file that has been given as input");
                        println!("  udp -> start listening to udp server on port 5000");
                        println!("  grab -> after observing a file we can grab lines with this command");
                        println!("  stop -> exit the interpreter");
                    }
                    Some(Command::Udp) => {
                        println!("udp command received");
                        start = Instant::now();
                        let cancel = cancel.clone();
                        tokio::spawn(async move {
                            static RECEIVER: &str = "127.0.0.1:5000";
                            let udp_source = UdpSource::new(RECEIVER, vec![]).await.unwrap();
                            let dlt_parser = DltParser::new(None, None, None, false);
                            let mut dlt_msg_producer = MessageProducer::new(dlt_parser, udp_source, None);
                            let msg_stream = dlt_msg_producer.as_stream();
                            pin_mut!(msg_stream);
                            loop {
                                select! {
                                    _ = cancel.cancelled() => {
                                        println!("received shutdown through future channel");
                                        break;
                                    }
                                    items = msg_stream.next() => {
                                        let items = match items {
                                            Some(item) => item,
                                            None => {
                                                println!("no msg");
                                                continue;
                                            }
                                        };
                                        for item in items {

                                            match item {
                                                (_, MessageStreamItem::Item(ParseYield::Message(msg))) => {
                                                    println!("msg: {msg}");
                                                }
                                                (_, MessageStreamItem::Item(ParseYield::MessageAndAttachment((msg, attachment)))) => {
                                                    println!("msg: {msg}, attachment: {attachment:?}");
                                                }
                                                (_, MessageStreamItem::Item(ParseYield::Attachment(attachment))) => {
                                                    println!("attachment: {attachment:?}");
                                                }
                                                _ => println!("no msg"),
                                            }
                                        }
                                    }
                                }
                            }
                            println!("Udp finished");
                        });
                    }
                    Some(Command::Observe) => {
                        println!("observe command received");
                        start = Instant::now();
                        let uuid = Uuid::new_v4();
                        let file_path = input.clone().expect("input must be present");
                        session.observe(uuid, ObserveOptions::file(file_path.clone(),FileFormat::Text, ParserType::Text)).expect("observe failed");
                    }
                    Some(Command::Dlt) => {
                        println!("dlt command received");
                        start = Instant::now();
                        let uuid = Uuid::new_v4();
                        let file_path = input.clone().expect("input must be present");
                        let dlt_parser_settings = DltParserSettings { filter_config: None, fibex_file_paths: None, with_storage_header: true, tz: None, fibex_metadata: None };
                        session.observe(uuid, ObserveOptions::file(file_path.clone(), FileFormat::Binary, ParserType::Dlt(dlt_parser_settings))).expect("observe failed");
                        println!("dlt session was destroyed");
                    }
                    Some(Command::Plugin) => {
                        println!("plugin command received");
                        const PLUGIN_PATH_ENV: &str = "WASM_PLUGIN_PATH";

                        //TODO AAZ: Find a better way to deliver plugin path than environment variables
                        let plugin_path = match std::env::var(PLUGIN_PATH_ENV) {
                            Ok(path) => path,
                            Err(err) => panic!("Retrieving plugin path environment variable failed. Err {err}") ,
                        };
                        start = Instant::now();
                        let uuid = Uuid::new_v4();
                        let file_path = input.clone().expect("input must be present");
                        let proto_plugin_path = PathBuf::from(plugin_path);
                        let plugin_parser_settings = PluginParserSettings::prototyping(proto_plugin_path);
                        session.observe(uuid, ObserveOptions::file(file_path, FileFormat::Binary, ParserType::Plugin(plugin_parser_settings))).expect("observe failed");
                    }
                    Some(Command::Grab) => {
                        println!("grab command received");
                        start = Instant::now();
                        let start_op = Instant::now();
                        let content = session.grab(LineRange::from(0u64..=1000)).await.expect("grab failed");
                        let len = content.len();
                        println!("content has {len} elemenst");
                        for elem in content {
                            println!("{elem:?}");
                        }
                        duration_report(start_op, format!("grabbing {len} lines"));
                    }
                    Some(Command::Stop) => {
                        println!("stop command received");
                        start = Instant::now();
                        cancel.cancel();
                        session.stop(uuid).await.unwrap();
                    }
                    None => {
                        println!("None command");
                        break;
                    }
                }
            }
            feedback = receiver.recv() => {
                if let Some(feedback) = feedback {
                    let elapsed = start.elapsed().as_millis();
                    println!("got session feedback after {elapsed} ms: {feedback:?}");
                } else {
                    println!("no more feedback comming");
                    break;
                }
            }
        }
    }
    println!("end of handle_interactive_session()");

    let stop_uuid = Uuid::new_v4();
    session.stop(stop_uuid).await.unwrap();
}

#[derive(Debug)]
enum Command {
    Observe,
    Dlt,
    Grab,
    Udp,
    Plugin,
    Stop,
    Help,
}

async fn collect_user_input(tx: mpsc::UnboundedSender<Command>) -> JoinHandle<()> {
    task::spawn_blocking(move || {
        let mut rl = DefaultEditor::new().expect("could not create editor");
        loop {
            let readline = rl.readline(">> ");
            match readline {
                Ok(line) => match line.as_str().to_lowercase().as_str() {
                    "observe" => {
                        tx.send(Command::Observe).expect("send failed");
                    }
                    "dlt" => {
                        tx.send(Command::Dlt).expect("send failed");
                    }
                    "stop" => {
                        tx.send(Command::Stop).expect("send failed");
                        break;
                    }
                    "udp" => {
                        tx.send(Command::Udp).expect("send failed");
                    }
                    "plugin" => {
                        tx.send(Command::Plugin).expect("send failed");
                    }
                    "grab" => {
                        tx.send(Command::Grab).expect("send failed");
                    }
                    "help" => {
                        tx.send(Command::Help).expect("send failed");
                    }
                    "exit" => {
                        println!("got exit");
                        break;
                    }
                    x => {
                        println!("unknown command: {x}");
                    }
                },
                Err(ReadlineError::Interrupted) => {
                    println!("CTRL-C");
                    tx.send(Command::Stop).expect("send failed");
                    break;
                }
                Err(ReadlineError::Eof) => {
                    println!("CTRL-D");
                    tx.send(Command::Stop).expect("send failed");
                    break;
                }
                Err(err) => {
                    println!("Error: {err:?}");
                    tx.send(Command::Stop).expect("send failed");
                    break;
                }
            }
        }
        println!("done with readline loop");
    })
}
