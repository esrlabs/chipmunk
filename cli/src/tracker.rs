use anyhow::{anyhow, Context, Error};
use console::style;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use std::{
    collections::BTreeMap,
    process::{Command, ExitStatus},
    time::Instant,
};
use tokio::sync::{
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    oneshot, OnceCell,
};

use crate::jobs_runner::JobDefinition;

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

#[derive(Debug)]
/// Represents tasks information that can be sent to and from the tracker
pub enum Tick {
    /// Change job status from awaiting to started.
    Started(JobDefinition, oneshot::Sender<()>),
    /// Start a job giving the job name and the sender to return the job number.
    StartAll(Vec<JobDefinition>, oneshot::Sender<()>),
    /// Update the job providing an optional progress value.
    Progress(JobDefinition, Option<u64>),
    /// Send a message to the job
    Message(JobDefinition, String),
    /// Sets the job as finished providing the job result and a message
    Finished(JobDefinition, OperationResult, String),
    #[allow(dead_code)]
    /// Prints the given text outside the progress bar
    Print(String),
    /// Close all the jobs and shutdown the progress bars
    Shutdown(oneshot::Sender<()>),
    /// Suspends the progress bars and execute the giving blocking command
    SuspendAndRun(Command, oneshot::Sender<anyhow::Result<ExitStatus>>),
}

#[derive(Clone, Debug)]
pub struct Tracker {
    tx: UnboundedSender<Tick>,
}

enum JobBarPhase {
    Pending,
    Running(Instant),
    Finished((OperationResult, u64)),
}

struct JobBarState {
    name: String,
    bar: ProgressBar,
    phase: JobBarPhase,
}

impl JobBarState {
    fn new(name: String, bar: ProgressBar) -> Self {
        Self {
            name,
            bar,
            phase: JobBarPhase::Pending,
        }
    }

    fn start(&mut self) {
        assert!(
            matches!(self.phase, JobBarPhase::Pending),
            "Start can be called on pending jobs only"
        );

        let start_time = Instant::now();
        self.phase = JobBarPhase::Running(start_time);
    }
}

pub async fn get_tracker() -> &'static Tracker {
    static TRACKER: OnceCell<Tracker> = OnceCell::const_new();

    TRACKER.get_or_init(|| async { Tracker::new() }).await
}

impl Tracker {
    fn new() -> Self {
        let (tx, rx): (UnboundedSender<Tick>, UnboundedReceiver<Tick>) = unbounded_channel();
        tokio::spawn(Tracker::run(rx));
        Self { tx }
    }

    async fn run(mut rx: UnboundedReceiver<Tick>) -> Result<(), Error> {
        let spinner_style =
            ProgressStyle::with_template("{spinner} {prefix:.bold.dim} {wide_msg}")?
                .tick_chars("▂▃▅▆▇▆▅▃▂ ");
        let mut max_time_len = 0;
        let max = u64::MAX;
        let mut bars: BTreeMap<JobDefinition, JobBarState> = BTreeMap::new();
        let mp = MultiProgress::new();
        let start_time = Instant::now();
        while let Some(tick) = rx.recv().await {
            match tick {
                Tick::Started(job_def, tx_response) => {
                    let Some(job) = bars.get_mut(&job_def) else {
                        unreachable!("Job must exist in progress bar before starting it. Job Info: {job_def:?}")
                    };
                    if matches!(job.phase, JobBarPhase::Pending) {
                        job.start();
                        Self::refresh_all_bars(&mut bars, max_time_len, None);
                    }

                    if tx_response.send(()).is_err() {
                        let _ = mp.println("Fail to send response while starting the jobs");
                    }
                }
                Tick::StartAll(jobs, tx_response) => {
                    for job in jobs.into_iter() {
                        let bar = mp.add(ProgressBar::new(max));
                        bar.set_style(spinner_style.clone());
                        let bar_text = format!(
                            "{}: {}",
                            job.target.relative_cwd().display(),
                            job.job_title()
                        );
                        let job_bar = JobBarState::new(bar_text, bar);
                        bars.insert(job, job_bar);
                    }

                    Self::refresh_all_bars(&mut bars, max_time_len, None);
                    if tx_response.send(()).is_err() {
                        let _ = mp.println("Fail to send response while starting the jobs");
                    }
                }
                Tick::Message(job_def, log) => match bars.get(&job_def) {
                    Some(job_bar) => job_bar.bar.set_message(log),
                    None => unreachable!(
                        "Job must exist in progress bar before messaging it. Job Info: {job_def:?}"
                    ),
                },
                Tick::Progress(job_def, pos) => {
                    let Some(job_bar) = bars.get(&job_def) else {
                        unreachable!("Job must exist in progress bar before changing it progress. Job Info: {job_def:?}")
                    };

                    if let Some(pos) = pos {
                        job_bar.bar.set_position(pos);
                    } else {
                        job_bar.bar.inc(1);
                    }
                }
                Tick::Finished(job_def, result, msg) => {
                    let Some(job_bar) = bars.get_mut(&job_def) else {
                        unreachable!("Job must exist in progress bar before finishing it. Job Info: {job_def:?}")
                    };

                    // It doesn't make sense to show that a job is done in 0 seconds
                    let time = match job_bar.phase {
                        JobBarPhase::Running(start_time) => start_time.elapsed().as_secs().max(1),
                        _ => unreachable!("Job must be running when finish is called"),
                    };

                    max_time_len = max_time_len.max(Self::count_digits(time));

                    job_bar.bar.finish_with_message(msg);
                    job_bar.phase = JobBarPhase::Finished((result, time));

                    Self::refresh_all_bars(&mut bars, max_time_len, None);
                }
                Tick::Print(msg) => {
                    let _ = mp.println(msg);
                }
                Tick::Shutdown(tx_response) => {
                    // Finish jobs that are still running
                    for (_job_def, job_bar) in bars.iter_mut() {
                        let time = match job_bar.phase {
                            JobBarPhase::Pending => 1,
                            JobBarPhase::Running(start_time) => {
                                start_time.elapsed().as_secs().max(1)
                            }
                            JobBarPhase::Finished(_) => continue,
                        };

                        job_bar.phase = JobBarPhase::Finished((OperationResult::Failed, time));
                        max_time_len = max_time_len.max(Self::count_digits(time));

                        job_bar.bar.finish();
                    }

                    // Insert graphic bar for the running duration of each bars
                    let total_time = start_time.elapsed().as_secs().max(1) as usize;
                    Self::refresh_all_bars(&mut bars, max_time_len, Some(total_time));

                    // Insert total time bar
                    let total_bar = mp.add(ProgressBar::new((bars.len() + 1) as u64));
                    total_bar.set_style(spinner_style.clone());
                    total_bar.set_prefix(format!("[total] done all in {total_time}s."));
                    total_bar.finish();

                    bars.clear();
                    // let _ = mp.clear();
                    if tx_response.send(()).is_err() {
                        let _ = mp.println("Fail to send response");
                    }
                    break;
                }
                Tick::SuspendAndRun(mut command, tx_response) => {
                    let status = mp
                        .suspend(|| command.status())
                        .context("Error while executing command");
                    if tx_response.send(status).is_err() {
                        let _ = mp.println("Fail to send response");
                    }
                }
            }
        }
        Ok(())
    }

    fn refresh_all_bars(
        bars: &mut BTreeMap<JobDefinition, JobBarState>,
        max_time_len: usize,
        total_time: Option<usize>,
    ) {
        let jobs_count_txt = bars.len().to_string();

        bars.iter_mut().enumerate().for_each(|(idx, (_job_def ,job_bar))| {
            let job_number = idx + 1;
            let seq_width = jobs_count_txt.len();
            let job = job_bar.name.as_str();
            let line_prefix = match &job_bar.phase {
                JobBarPhase::Pending => format!("[{job_number:seq_width$}/{jobs_count_txt}][{}][{job}]", style("wait").bold().blue()),
                JobBarPhase::Running(_) => format!("[{job_number:seq_width$}/{jobs_count_txt}][....][{job}]"),
                JobBarPhase::Finished((res, time)) => {
                    if let Some(total_time) = total_time {
                        let finish_limit = (*time as usize * TIME_BAR_WIDTH) / total_time;
                        let time_bar: String = (0..TIME_BAR_WIDTH).map(|idx| if idx <= finish_limit {'█'}else {'░'}).collect();
                        format!("[{job_number:seq_width$}/{jobs_count_txt}][{res}][{time_bar} {time:max_time_len$}s][{job}].")
                    }else {
                        format!("[{job_number:seq_width$}/{jobs_count_txt}][{res}][{time:max_time_len$}s][{job}].")
                    }
                },
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

    pub async fn start_all(&self, jobs: Vec<JobDefinition>) -> Result<(), Error> {
        let (tx_response, rx_response) = oneshot::channel();
        self.tx
            .send(Tick::StartAll(jobs, tx_response))
            .context("Fail to send tick")?;
        rx_response.await.context("Fail to receive tick start all")
    }

    /// Change job status from awaiting to started.
    pub async fn start(&self, job_def: JobDefinition) -> Result<(), Error> {
        let (tx_response, rx_response) = oneshot::channel();
        self.tx
            .send(Tick::Started(job_def, tx_response))
            .context("Fail to send tick")?;
        rx_response
            .await
            .context("Fail to receive tick Start Single")
    }

    /// Update the job providing an optional progress value.
    pub async fn progress(&self, job_def: JobDefinition, pos: Option<u64>) {
        if let Err(e) = self.tx.send(Tick::Progress(job_def, pos)) {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    /// Send a message to the job
    pub async fn msg(&self, job_def: JobDefinition, log: String) {
        if let Err(e) = self.tx.send(Tick::Message(job_def, log)) {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    /// Sets the job as finished providing successful result and a message
    pub async fn success(&self, job_def: JobDefinition, msg: String) {
        if let Err(e) = self
            .tx
            .send(Tick::Finished(job_def, OperationResult::Success, msg))
        {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    /// Sets the job as finished providing failed result and a message
    pub async fn fail(&self, job_def: JobDefinition, msg: String) {
        if let Err(e) = self
            .tx
            .send(Tick::Finished(job_def, OperationResult::Failed, msg))
        {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    /// Close all the jobs and shutdown the progress bars
    pub async fn shutdown(&self) -> Result<(), Error> {
        let (tx_response, rx_response) = oneshot::channel();
        self.tx
            .send(Tick::Shutdown(tx_response))
            .context("Fail to send tick")?;
        rx_response.await.context("Fail to receive tick")
    }

    /// Prints the given text outside the progress bar
    pub async fn print(&self, msg: String) {
        if let Err(e) = self
            .tx
            .send(Tick::Print(msg))
            .map_err(|e| anyhow!("Fail to send tick: {e}"))
        {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    /// Suspend the progress bars and run the giving blocking command returning its exit status
    pub async fn suspend_and_run(
        &self,
        cmd: std::process::Command,
    ) -> Result<ExitStatus, anyhow::Error> {
        let (tx_response, rx_response) = oneshot::channel();
        self.tx
            .send(Tick::SuspendAndRun(cmd, tx_response))
            .context("Fail to send tick")?;

        rx_response.await.context("Fail to receive tick")?
    }
}
