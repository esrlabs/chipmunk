export class NormalizedBackgroundTask {
    protected timer: any = -1;
    protected timestamp: number = 0;
    protected duration: number;
    protected readonly controller: AbortController = new AbortController();

    constructor(duration: number) {
        this.duration = duration;
        this.timestamp = Date.now();
        this.safe = this.safe.bind(this);
    }

    public run(task: () => void) {
        clearTimeout(this.timer);
        const diff = Date.now() - this.timestamp;
        if (diff > this.duration) {
            // This task should be done in any way - do not store timer ref
            setTimeout(this.safe(task, true), 0);
        } else {
            // This task could be canceled, store reference
            this.timer = setTimeout(this.safe(task, false), this.duration - diff);
        }
    }

    public abort(): void {
        clearTimeout(this.timer);
        this.controller.abort();
    }

    protected safe(task: () => void, untracked: boolean): () => void {
        return () => {
            if (this.controller.signal.aborted) {
                return;
            }
            task();
            this.timestamp = untracked ? 0 : Date.now();
        };
    }
}
