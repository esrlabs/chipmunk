import { unique } from 'platform/env/sequence';
import * as validator from 'platform/env/obj';
import * as Events from 'platform/ipc/event';

const GLOBAL_JOBS = `___global_jobs___`;

export interface IJob {
    uuid: string;
    progress: number;
    session?: string;
    desc?: string;
}

export class Job {
    public uuid: string;
    public progress = 0;
    public session: string;
    public name?: string;
    public desc?: string;
    public icon?: string;

    private _canceled = false;
    private _created: number = Date.now();
    private _done: (job: Job) => void;

    constructor(job: {
        uuid?: string;
        session?: string;
        name?: string;
        desc?: string;
        progress?: number;
        icon?: string;
        done: (job: Job) => void;
    }) {
        this.uuid = job.uuid !== undefined ? job.uuid : unique();
        this.session = validator.getAsNotEmptyStringOrAsUndefined(job, 'session');
        this.name = validator.getAsNotEmptyStringOrAsUndefined(job, 'name');
        this.desc = validator.getAsNotEmptyStringOrAsUndefined(job, 'desc');
        this.icon = validator.getAsNotEmptyStringOrAsUndefined(job, 'icon');
        this.progress = validator.getAsValidNumber(job, 'progress', {
            defaults: 0,
            max: 100,
            min: 0,
        });
        this.session = this.session === undefined ? GLOBAL_JOBS : this.session;
        this._done = job.done;
    }

    public start(): Job {
        if (this.isCanceled()) {
            return this;
        }
        if (this.progress === 100) {
            throw new Error(`Operation ${this.uuid} has been done already. Desc: ${this.desc}`);
        }
        this.progress = 0;
        Events.IpcEvent.emit(
            new Events.State.Job.Event({
                uuid: this.uuid,
                session: this.session,
                name: this.name,
                desc: this.desc,
                progress: this.progress,
                icon: this.icon,
            }),
        );
        return this;
    }

    public rise(progress: number, desc?: string): Job {
        if (this.isCanceled()) {
            return this;
        }
        if (this.progress === 100) {
            throw new Error(`Operation ${this.uuid} has been done already. Desc: ${this.desc}`);
        }
        this.progress = progress;
        this.desc = desc;
        Events.IpcEvent.emit(
            new Events.State.Job.Event({
                uuid: this.uuid,
                session: this.session,
                name: this.name,
                desc: this.desc,
                progress: this.progress,
                icon: this.icon,
            }),
        );
        return this;
    }

    public done(inputs?: {
        name: string | undefined;
        desc: string | undefined;
        icon: string | undefined;
    }): Job {
        if (this.isCanceled()) {
            return this;
        }
        if (this.progress === 100) {
            throw new Error(`Operation ${this.uuid} has been done already. Desc: ${this.desc}`);
        }
        const update: {
            name?: string;
            desc?: string;
            icon?: string;
        } = inputs === undefined ? {} : inputs;
        this.name = update.name !== undefined ? update.name : this.name;
        this.desc =
            update.desc !== undefined ? update.desc : this.desc === undefined ? 'done' : this.desc;
        this.icon = typeof update.icon === 'string' ? update.icon : this.icon;
        this.progress = 100;
        this.desc = `[${((Date.now() - this._created) / 1000).toFixed(2)}s] ${this.desc}`;
        Events.IpcEvent.emit(
            new Events.State.Job.Event({
                uuid: this.uuid,
                session: this.session,
                name: this.name,
                desc: this.desc,
                progress: this.progress,
                icon: this.icon,
            }),
        );
        this._done(this);
        return this;
    }

    public cancel() {
        this._canceled = true;
    }

    public isCanceled(): boolean {
        return this._canceled;
    }
}
