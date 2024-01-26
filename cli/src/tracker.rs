use async_channel::{bounded, unbounded, Receiver, Sender};
use async_std::task;
use console::style;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use std::{
    collections::HashMap,
    io::{Error, ErrorKind},
    time::Instant,
};

#[derive(Clone, Debug)]
pub enum OperationResult {
    Success,
    Failed,
}

impl std::fmt::Display for OperationResult {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                OperationResult::Success => style("done").bold().green(),
                OperationResult::Failed => style("fail").bold().red(),
            }
        )
    }
}

#[derive(Clone, Debug)]
pub enum Tick {
    Started(String, Option<u64>, Sender<usize>),
    Progress(usize, Option<u64>),
    Message(usize, String),
    Finished(usize, OperationResult, String),
    #[allow(dead_code)]
    Print(String),
    Shutdown(Sender<()>),
}

#[derive(Clone, Debug)]
pub struct Tracker {
    tx: Sender<Tick>,
}

enum TimeIndicator {
    Running(Instant),
    Finished(u64),
}

impl Tracker {
    pub fn new() -> Self {
        let (tx, rx): (Sender<Tick>, Receiver<Tick>) = unbounded();
        task::spawn(Tracker::run(rx));
        Self { tx }
    }

    pub async fn run(rx: Receiver<Tick>) -> Result<(), Error> {
        let spinner_style = ProgressStyle::with_template("{spinner} {prefix:.bold.dim} {wide_msg}")
            .map_err(|e| Error::new(ErrorKind::Other, e.to_string()))?
            .tick_chars("▂▃▅▆▇▆▅▃▂ ");
        async move {
            let mut sequence: usize = 0;
            let mut max_time_len = 0;
            let max = u64::MAX;
            let mut bars: HashMap<usize, (ProgressBar, TimeIndicator, String, Option<OperationResult>)> =
                HashMap::new();
            let mp = MultiProgress::new();
            let start_time = Instant::now();
            while let Ok(tick) = rx.recv().await {
                match tick {
                    Tick::Started(job, len, tx_response) => {
                        sequence += 1;
                        let sequence_txt = sequence.to_string();
                        let bar = mp.add(ProgressBar::new(len.unwrap_or(max)));
                        bar.set_style(spinner_style.clone());
                        bars.insert(sequence, (bar, TimeIndicator::Running(Instant::now()), job, None));
                        bars.iter_mut().for_each(|(k, (bar, time_indicator, job, result))| {
                            let seq_width = sequence_txt.len();
                            let line_prefix = match time_indicator {
                                TimeIndicator::Running(_) => {
                                format!(
                                    "[{:seq_width$}/{sequence_txt}][{}][{job}]",
                                    k,
                                    String::from("....")
                                )
                                },
                                TimeIndicator::Finished(time) => {
                                format!(
                                    "[{:seq_width$}/{sequence_txt}][{}][{time:max_time_len$}s][{job}].",
                                    k,
                                    result
                                        .as_ref()
                                        .expect("Job must be finished here")
                                )
                                },
                            };

                            bar.set_prefix(line_prefix);
                        });
                        if let Err(e) = tx_response.send(sequence).await {
                            let _ = mp.println(format!("Fail to send response: {e}"));
                        }
                    }
                    Tick::Message(sequence, log) => {
                        if let Some((bar, _, _, _)) = bars.get(&sequence) {
                            bar.set_message(log);
                        }
                    }
                    Tick::Progress(sequence, pos) => {
                        if let Some((bar, _, _, _)) = bars.get(&sequence) {
                            if let Some(pos) = pos {
                                bar.set_position(pos);
                            } else {
                                bar.inc(1);
                            }
                        }
                    }
                    Tick::Finished(seq, result, msg) => {
                        if let Some((bar, time_indicator, job, res)) = bars.get_mut(&seq) {
                            let sequence_txt = sequence.to_string();
                            let TimeIndicator::Running(instant) = time_indicator else {panic!("{job} can finish only once")}; 
                            // It doesn't make sense to show that a job is done in 0 seconds
                            let time = instant.elapsed().as_secs().max(1);
                            *time_indicator = TimeIndicator::Finished(time);

                            max_time_len = max_time_len.max(Self::count_digits(time));

                            let seq_width = sequence_txt.len();
                            bar.set_prefix(format!(
                                "[{seq:seq_width$}/{sequence_txt}][{result}][{time:max_time_len$}s][{job}].",
                            ));
                            bar.finish_with_message(msg);
                            res.replace(result);
                        }
                    }
                    Tick::Print(msg) => {
                        let _ = mp.println(msg);
                    }
                    Tick::Shutdown(tx_response) => {
                        bars.iter_mut().for_each(|(_, (bar, time_indicator, job, _))| {
                            if !bar.is_finished() {
                                let TimeIndicator::Running(instant) = time_indicator else {panic!("{job} can finish only once")};
                                let time = instant.elapsed().as_secs().max(1);
                                *time_indicator = TimeIndicator::Finished(time);
                                max_time_len = max_time_len.max(Self::count_digits(time));

                                bar.finish();
                            }
                        });

                        // Insert total time bar
                        let total_time = start_time.elapsed().as_secs().max(1);
                        let total_bar = mp.add(ProgressBar::new((bars.len() + 1) as u64));
                        total_bar.set_style(spinner_style.clone());
                        total_bar.set_prefix(format!("[total] done all in {total_time}s."));
                        total_bar.finish();

                        bars.clear();
                        // let _ = mp.clear();
                        if let Err(e) = tx_response.send(()).await {
                            let _ = mp.println(format!("Fail to send response: {e}"));
                        }
                        break;
                    }
                }
            }
        }
        .await;
        Ok(())
    }

    /// Counts the digits in a number without allocating new string
    fn count_digits(mut num: u64) -> usize {
        if num == 0 {
            return 1; // Special case for zero
        }

        let mut count = 0;
        while num > 0 {
            num /= 10;
            count += 1;
        }
        count
    }

    pub async fn start(&self, job: &str, max: Option<u64>) -> Result<usize, Error> {
        let (tx_response, rx_response) = bounded(1);
        self.tx
            .send(Tick::Started(job.to_string(), max, tx_response))
            .await
            .map_err(|e| Error::new(ErrorKind::Other, format!("Fail to send tick: {e}")))?;
        rx_response
            .recv()
            .await
            .map_err(|e| Error::new(ErrorKind::NotConnected, e.to_string()))
    }

    pub async fn progress(&self, sequence: usize, pos: Option<u64>) {
        if let Err(e) = self.tx.send(Tick::Progress(sequence, pos)).await {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    pub async fn msg(&self, sequence: usize, log: &str) {
        if let Err(e) = self.tx.send(Tick::Message(sequence, log.to_string())).await {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    pub async fn success(&self, sequence: usize, msg: &str) {
        if let Err(e) = self
            .tx
            .send(Tick::Finished(
                sequence,
                OperationResult::Success,
                msg.to_string(),
            ))
            .await
        {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    pub async fn fail(&self, sequence: usize, msg: &str) {
        if let Err(e) = self
            .tx
            .send(Tick::Finished(
                sequence,
                OperationResult::Failed,
                msg.to_string(),
            ))
            .await
        {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    pub async fn shutdown(&self) -> Result<(), Error> {
        let (tx_response, rx_response) = bounded(1);
        self.tx
            .send(Tick::Shutdown(tx_response))
            .await
            .map_err(|e| Error::new(ErrorKind::Other, format!("Fail to send tick: {e}")))?;
        rx_response
            .recv()
            .await
            .map_err(|e| Error::new(ErrorKind::NotConnected, e.to_string()))
    }

    pub async fn _print(&self, msg: String) {
        if let Err(e) = self
            .tx
            .send(Tick::Print(msg))
            .await
            .map_err(|e| Error::new(ErrorKind::Other, format!("Fail to send tick: {e}")))
        {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }
}
