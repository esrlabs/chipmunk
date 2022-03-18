use crate::{duration_report, Instant};
use processor::grabber::LineRange;
use rustyline::{error::ReadlineError, Editor};
use session::session::Session;
use sources::factory::{ParserType, Source};
use std::path::PathBuf;
use tokio::{select, sync::mpsc, task, task::JoinHandle};

use uuid::Uuid;

pub(crate) async fn handle_interactive_session(matches: &clap::ArgMatches) {
    let uuid = Uuid::new_v4();
    let (session, mut receiver) = Session::new(uuid).await;
    let file_name = matches.value_of("input").expect("input must be present");
    let file_path = PathBuf::from(file_name);
    let (tx, mut rx) = mpsc::unbounded_channel();
    collect_user_input(tx).await;
    loop {
        select! {
            command = rx.recv() => {
                println!("received command: {:?}", command);
                match command {
                    Some(Command::Observe) => {
                        println!("observe command received");
                        let uuid = Uuid::new_v4();
                        let source = Source::File(file_path.clone(), ParserType::Text);
                        session.observe(uuid, source).expect("observe failed");
                    }
                    Some(Command::Grab) => {
                        println!("grab command received");
                        let start_op = Instant::now();
                        let content = session.grab(LineRange::from(0u64..=1000)).await.expect("grab failed");
                        let len = content.grabbed_elements.len();
                        println!("content has {} elemenst", len);
                        for elem in content.grabbed_elements {
                            println!("{:?}", elem);
                        }
                        duration_report(start_op, format!("grabbing {} lines", len));
                    }
                    Some(Command::Stop) => {
                        println!("stop command received");
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
                    println!("got session feedback: {:?}", feedback);
                } else {
                    println!("no more feedback comming");
                    break;
                }
            }
        }
    }
    println!("end of handle_interactive_session()");
}

#[derive(Debug)]
enum Command {
    Observe,
    Grab,
    Stop,
}

async fn collect_user_input(tx: mpsc::UnboundedSender<Command>) -> JoinHandle<()> {
    task::spawn_blocking(move || {
        let mut rl = Editor::<()>::new();
        loop {
            let readline = rl.readline(">> ");
            match readline {
                Ok(line) => match line.as_str() {
                    "observe" => {
                        tx.send(Command::Observe).expect("send failed");
                    }
                    "stop" => {
                        tx.send(Command::Stop).expect("send failed");
                    }
                    "grab" => {
                        tx.send(Command::Grab).expect("send failed");
                    }
                    "exit" => {
                        println!("got exit");
                        break;
                    }
                    x => println!("unknown command: {}", x),
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
                    println!("Error: {:?}", err);
                    tx.send(Command::Stop).expect("send failed");
                    break;
                }
            }
        }
        println!("done with readline loop");
    })
}
