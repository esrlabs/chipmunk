use anyhow::{anyhow, Context, Error};
use console::style;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use std::{
    collections::BTreeMap,
    iter,
    process::{Command, ExitStatus},
    sync::OnceLock,
    time::Instant,
};
use tokio::sync::{
    mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
    oneshot,
};

use crate::jobs_runner::JobDefinition;

const TIME_BAR_WIDTH: usize = 5;

static TRACKER: OnceLock<Tracker> = OnceLock::new();

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
enum UiTick {
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
    /// Prints the given text outside the progress bar
    Print(String),
    /// Close all the jobs and shutdown the progress bars
    Shutdown(oneshot::Sender<()>),
    /// Suspends the progress bars and execute the giving blocking command
    SuspendAndRun(Command, oneshot::Sender<anyhow::Result<ExitStatus>>),
}

#[derive(Debug)]
/// Represents Log messages that can be sent to be saved in the log cache then retrieved one needed
enum LogTick {
    RegisterAll(Vec<JobDefinition>, oneshot::Sender<()>),
    /// Sends the given log to be saved with the associated job definition.
    SendSingleLog(JobDefinition, String),
    /// Retrieves all the logs for the giving job, clearing them from the cache.
    GetLogs(JobDefinition, oneshot::Sender<Vec<String>>),
}

#[derive(Clone, Debug)]
pub struct Tracker {
    ui_tx: UnboundedSender<UiTick>,
    log_tx: UnboundedSender<LogTick>,
    no_ui: bool,
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

/// Initialize progress tracker with the given configurations.
///
/// # Panics
///
/// This functions panics if it is initialized more than once.
pub fn init_tracker(no_ui: bool) {
    TRACKER
        .set(Tracker::new(no_ui))
        .expect("Progress Tracker can't be initialized more than once");
}

/// Gets a reference to the initialized progress tracker
///
/// # Panics
///
/// This function panics if the tracker isn't initialized yet.
pub fn get_tracker() -> &'static Tracker {
    TRACKER
        .get()
        .expect("Tracker must be initialized before it's called")
}

impl Tracker {
    fn new(no_ui: bool) -> Self {
        // Logs
        let (log_tx, log_rx) = unbounded_channel();
        tokio::spawn(Tracker::run_logs_cache(log_rx));

        // UI
        let (ui_tx, ui_rx) = unbounded_channel();
        if !no_ui {
            tokio::spawn(Tracker::run_ui(ui_rx));
        }
        Self {
            ui_tx,
            log_tx,
            no_ui,
        }
    }

    async fn run_logs_cache(mut rx: UnboundedReceiver<LogTick>) {
        let mut logs_map: BTreeMap<JobDefinition, Vec<String>> = BTreeMap::new();

        while let Some(tick) = rx.recv().await {
            match tick {
                LogTick::RegisterAll(jobs, tx_response) => {
                    debug_assert!(
                        logs_map.is_empty(),
                        "Jobs must be registered in logs once only"
                    );
                    logs_map.extend(jobs.into_iter().map(|job| (job, Vec::new())));

                    if tx_response.send(()).is_err() {
                        eprintln!("Fail to send response after registering the jobs for logs");
                    }
                }
                LogTick::SendSingleLog(job, log) => {
                    let log_records = logs_map
                        .get_mut(&job)
                        .expect("Job must be registered in logs map");
                    log_records.push(log);
                }
                LogTick::GetLogs(job, tx) => {
                    let log_records = logs_map
                        .get_mut(&job)
                        .expect("Job must be registered in logs map");

                    let logs = std::mem::take(log_records);

                    if tx.send(logs).is_err() {
                        eprintln!("Fail to send response with the cached logs");
                    }
                }
            }
        }
    }

    async fn run_ui(mut rx: UnboundedReceiver<UiTick>) {
        let spinner_style = ProgressStyle::with_template("{spinner} {prefix:.bold.dim} {wide_msg}")
            .expect("Progress template must be valid")
            .tick_chars("▂▃▅▆▇▆▅▃▂ ");
        let mut max_time_len = 0;
        let max = u64::MAX;
        let mut bars: BTreeMap<JobDefinition, JobBarState> = BTreeMap::new();
        let mp = MultiProgress::new();
        let start_time = Instant::now();
        while let Some(tick) = rx.recv().await {
            match tick {
                UiTick::Started(job_def, tx_response) => {
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
                UiTick::StartAll(jobs, tx_response) => {
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
                UiTick::Message(job_def, log) => match bars.get(&job_def) {
                    Some(job_bar) => job_bar.bar.set_message(log),
                    None => unreachable!(
                        "Job must exist in progress bar before messaging it. Job Info: {job_def:?}"
                    ),
                },
                UiTick::Progress(job_def, pos) => {
                    let Some(job_bar) = bars.get(&job_def) else {
                        unreachable!("Job must exist in progress bar before changing it progress. Job Info: {job_def:?}")
                    };

                    if let Some(pos) = pos {
                        job_bar.bar.set_position(pos);
                    } else {
                        job_bar.bar.inc(1);
                    }
                }
                UiTick::Finished(job_def, result, msg) => {
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
                UiTick::Print(msg) => {
                    let _ = mp.println(msg);
                }
                UiTick::Shutdown(tx_response) => {
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
                UiTick::SuspendAndRun(mut command, tx_response) => {
                    let status = mp
                        .suspend(|| command.status())
                        .context("Error while executing command");
                    if tx_response.send(status).is_err() {
                        let _ = mp.println("Fail to send response");
                    }
                }
            }
        }
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

    /// Registers all the given jobs for Logs and UI, setting their status to awaiting.
    /// This function must be called once on the start of running the tasks
    pub async fn register_all(&self, jobs: Vec<JobDefinition>) -> Result<(), Error> {
        let (log_tx, log_rx) = oneshot::channel();
        self.log_tx
            .send(LogTick::RegisterAll(jobs.clone(), log_tx))
            .context("Fail to send log Tick")?;

        if self.no_ui {
            return log_rx
                .await
                .context("Fail to receive log tick for register all jobs");
        }

        let (ui_tx, ui_rx) = oneshot::channel();
        self.ui_tx
            .send(UiTick::StartAll(jobs, ui_tx))
            .context("Fail to send tick")?;
        let (log_res, ui_res) = tokio::join!(log_rx, ui_rx);

        log_res.context("Fail to receive log tick for register all jobs")?;

        ui_res.context("Fail to receive ui tick for register all jobs")
    }

    /// Change job status on UI from awaiting to started.
    pub async fn start(&self, job_def: JobDefinition) -> Result<(), Error> {
        if self.no_ui {
            return Ok(());
        }
        let (tx_response, rx_response) = oneshot::channel();
        self.ui_tx
            .send(UiTick::Started(job_def, tx_response))
            .context("Fail to send tick")?;
        rx_response
            .await
            .context("Fail to receive tick Start Single")
    }

    /// Update the job on UI providing an optional progress value.
    pub fn progress(&self, job_def: JobDefinition, pos: Option<u64>) {
        if self.no_ui {
            return;
        }
        if let Err(e) = self.ui_tx.send(UiTick::Progress(job_def, pos)) {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    /// Send a message of the job to be shown on UI and saved in logs cache.
    pub fn msg(&self, job_def: JobDefinition, log: String) {
        if let Err(err) = self
            .log_tx
            .send(LogTick::SendSingleLog(job_def, log.clone()))
        {
            eprintln!("Fail to communicate with tracker: {err}");
        }

        if self.no_ui {
            return;
        }

        if let Err(e) = self.ui_tx.send(UiTick::Message(job_def, log)) {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    /// Send a message of the job to be be saved within logs cache without showing it in UI.
    pub fn log(&self, job_def: JobDefinition, log: String) {
        if let Err(err) = self
            .log_tx
            .send(LogTick::SendSingleLog(job_def, log.clone()))
        {
            eprintln!("Fail to communicate with tracker: {err}");
        }

        //TODO AAZ: This should be considered in case we want to print everything to console as
        //well.
    }

    /// Sets the job on UI as finished providing successful result and a message.
    pub fn success(&self, job_def: JobDefinition, msg: String) {
        if self.no_ui {
            return;
        }

        if let Err(e) = self
            .ui_tx
            .send(UiTick::Finished(job_def, OperationResult::Success, msg))
        {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    /// Sets the job on UI as finished providing failed result and a message
    pub fn fail(&self, job_def: JobDefinition, msg: String) {
        if self.no_ui {
            return;
        }

        if let Err(e) = self
            .ui_tx
            .send(UiTick::Finished(job_def, OperationResult::Failed, msg))
        {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    /// Close all the jobs and shutdown the progress bars
    pub async fn shutdown(&self) -> Result<(), Error> {
        if self.no_ui {
            return Ok(());
        }

        let (tx_response, rx_response) = oneshot::channel();
        self.ui_tx
            .send(UiTick::Shutdown(tx_response))
            .context("Fail to send tick")?;
        rx_response.await.context("Fail to receive tick")
    }

    /// Prints the given text on UI outside the progress bar.
    /// This message won't be included in any logs cache.
    pub fn print(&self, msg: String) {
        if self.no_ui {
            return;
        }

        if let Err(e) = self
            .ui_tx
            .send(UiTick::Print(msg))
            .map_err(|e| anyhow!("Fail to send tick: {e}"))
        {
            eprintln!("Fail to communicate with tracker: {e}");
        }
    }

    /// Run the given command synchronously, suspending the progress bars if enabled and printing
    /// the command output directly to the console, returning the command exit status.
    /// The output of the command can't be saved in logs cache.
    pub async fn run_synchronously(
        &self,
        job_def: JobDefinition,
        mut cmd: std::process::Command,
    ) -> Result<ExitStatus, anyhow::Error> {
        if self.no_ui {
            // Print jobs and command
            let cmd_parts: Vec<_> = iter::once(cmd.get_program().to_string_lossy())
                .chain(cmd.get_args().map(|args| args.to_string_lossy()))
                .collect();
            let cmd_txt: String = cmd_parts.join(" ");
            println!("Job {}: Running command {cmd_txt}...", job_def.job_title());

            cmd.status()
                .context("Error while execution command synchronously")
        } else {
            let (tx_response, rx_response) = oneshot::channel();
            self.ui_tx
                .send(UiTick::SuspendAndRun(cmd, tx_response))
                .context("Fail to send tick")?;

            let output_res = rx_response.await.context("Fail to receive tick")?;

            output_res.context("Error while execution command synchronously")
        }
    }

    /// Retrieves all the logs for the giving job, clearing them from the cache.
    ///
    /// # Panics
    ///
    /// This function panics if the jobs wasn't registered
    pub async fn get_logs(&self, job_def: JobDefinition) -> anyhow::Result<Vec<String>> {
        let (tx, rx) = oneshot::channel();

        self.log_tx
            .send(LogTick::GetLogs(job_def, tx))
            .with_context(|| {
                format!(
                    "Fail to send log Tick while getting logs for job: {}",
                    job_def.job_title()
                )
            })?;

        let logs = rx.await.with_context(|| {
            format!(
                "Fail to receive get logs tick results while getting logs for job: {}",
                job_def.job_title()
            )
        })?;

        Ok(logs)
    }
}
