use async_channel::{bounded, unbounded, Receiver, Sender};
use async_std::task;
use console::style;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use std::{
    collections::HashMap,
    io::{Error, ErrorKind},
    time::Instant,
};

const TIME_BAR_WIDTH: usize = 5;

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

struct JobBarState {
    name: String,
    bar: ProgressBar,
    start_time: Instant,
    result: Option<(OperationResult, u64)>,
}

impl JobBarState {
    fn start_job(name: String, bar: ProgressBar) -> Self {
        let start_time = Instant::now();

        Self {
            name,
            bar,
            start_time,
            result: None,
        }
    }
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
            let mut bars: HashMap<usize, JobBarState> = HashMap::new();
            let mp = MultiProgress::new();
            let start_time = Instant::now();
            while let Ok(tick) = rx.recv().await {
                match tick {
                    Tick::Started(job, len, tx_response) => {
                        sequence += 1;
                        let bar = mp.add(ProgressBar::new(len.unwrap_or(max)));
                        bar.set_style(spinner_style.clone());
                        let job_bar = JobBarState::start_job(job, bar);
                        bars.insert(sequence, job_bar);
                        Self::refresh_all_bars(&mut bars, sequence, max_time_len, None);
                        if let Err(e) = tx_response.send(sequence).await {
                            let _ = mp.println(format!("Fail to send response: {e}"));
                        }
                    }
                    Tick::Message(sequence, log) => {
                        if let Some(job_bar) = bars.get(&sequence) {
                            job_bar.bar.set_message(log);
                        }
                    }
                    Tick::Progress(sequence, pos) => {
                        if let Some(job_bar) = bars.get(&sequence) {
                            if let Some(pos) = pos {
                                job_bar.bar.set_position(pos);
                            } else {
                                job_bar.bar.inc(1);
                            }
                        }
                    }
                    Tick::Finished(seq, result, msg) => {
                        if let Some(job_bar) = bars.get_mut(&seq) {
                            let sequence_txt = sequence.to_string();
                            // It doesn't make sense to show that a job is done in 0 seconds
                            let time = job_bar.start_time.elapsed().as_secs().max(1);

                            max_time_len = max_time_len.max(Self::count_digits(time));

                            let seq_width = sequence_txt.len();
                            let job = job_bar.name.as_str();
                            job_bar.bar.set_prefix(format!(
                                "[{seq:seq_width$}/{sequence_txt}][{result}][{time:max_time_len$}s][{job}].",
                            ));
                            job_bar.bar.finish_with_message(msg);
                            job_bar.result.replace((result, time));

                            Self::refresh_all_bars(&mut bars, sequence, max_time_len, None);
                        }
                    }
                    Tick::Print(msg) => {
                        let _ = mp.println(msg);
                    }
                    Tick::Shutdown(tx_response) => {
                        bars.iter_mut().for_each(|(_, job_bar)| {
                            if !job_bar.bar.is_finished() {
                                let time = job_bar.start_time.elapsed().as_secs().max(1);
                                job_bar.result.replace((OperationResult::Success, time));
                                max_time_len = max_time_len.max(Self::count_digits(time));

                                job_bar.bar.finish();
                            }
                        });

                        // Insert graphic bar for the running duration of each bars
                        let total_time = start_time.elapsed().as_secs().max(1) as usize;
                        Self::refresh_all_bars(&mut bars, sequence, max_time_len, Some(total_time));

                        // Insert total time bar
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

    fn refresh_all_bars(
        bars: &mut HashMap<usize, JobBarState>,
        sequence: usize,
        max_time_len: usize,
        total_time: Option<usize>,
    ) {
        let sequence_txt = sequence.to_string();

        bars.iter_mut().for_each(|(k, job_bar)| {
            let seq_width = sequence_txt.len();
            let job = job_bar.name.as_str();
            let line_prefix = match job_bar.result.as_ref() {
                None => {
                    format!("[{k:seq_width$}/{sequence_txt}][....][{job}]")
                }
                Some((res, time)) => {
                    if let Some(total_time) = total_time {
                        let finish_limit = (*time as usize * TIME_BAR_WIDTH) / total_time;
                        let time_bar: String = (0..TIME_BAR_WIDTH).map(|idx| if idx <= finish_limit {'█'}else {'░'}).collect();
                        format!("[{k:seq_width$}/{sequence_txt}][{res}][{time_bar} {time:max_time_len$}s][{job}].")
                    }else {
                        format!("[{k:seq_width$}/{sequence_txt}][{res}][{time:max_time_len$}s][{job}].")
                    }
                }
            };

            job_bar.bar.set_prefix(line_prefix);
        });
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
