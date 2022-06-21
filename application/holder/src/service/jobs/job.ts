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
    public desc?: string;
    public icon?: string;
    public pinned: boolean;
    private _created: number = Date.now();
    private _done: (job: Job) => void;

    constructor(job: {
        uuid?: string;
        session?: string;
        desc?: string;
        progress?: number;
        pinned?: boolean;
        icon?: string;
        done: (job: Job) => void;
    }) {
        this.uuid = job.uuid !== undefined ? job.uuid : unique();
        this.session = validator.getAsNotEmptyStringOrAsUndefined(job, 'session');
        this.desc = validator.getAsNotEmptyStringOrAsUndefined(job, 'desc');
        this.icon = validator.getAsNotEmptyStringOrAsUndefined(job, 'icon');
        this.progress = validator.getAsValidNumber(job, 'progress', {
            defaults: 0,
            max: 100,
            min: 0,
        });
        this.pinned = validator.getAsBool(job, 'pinned', false);
        this.session = this.session === undefined ? GLOBAL_JOBS : this.session;
        this._done = job.done;
    }

    public start(): Job {
        if (this.progress === 100) {
            throw new Error(`Operation ${this.uuid} has been done already. Desc: ${this.desc}`);
        }
        this.progress = 0;
        Events.IpcEvent.emit(
            new Events.State.Job.Event({
                uuid: this.uuid,
                session: this.session,
                desc: this.desc,
                progress: this.progress,
                pinned: this.pinned,
                icon: this.icon,
            }),
        );
        return this;
    }

    public rise(progress: number, desc?: string): Job {
        if (this.progress === 100) {
            throw new Error(`Operation ${this.uuid} has been done already. Desc: ${this.desc}`);
        }
        this.progress = progress;
        this.desc = desc;
        Events.IpcEvent.emit(
            new Events.State.Job.Event({
                uuid: this.uuid,
                session: this.session,
                desc: this.desc,
                progress: this.progress,
                pinned: this.pinned,
                icon: this.icon,
            }),
        );
        return this;
    }

    public done(): Job {
        if (this.progress === 100) {
            throw new Error(`Operation ${this.uuid} has been done already. Desc: ${this.desc}`);
        }
        this.progress = 100;
        Events.IpcEvent.emit(
            new Events.State.Job.Event({
                uuid: this.uuid,
                session: this.session,
                desc: this.desc,
                progress: this.progress,
                pinned: this.pinned,
                icon: this.icon,
            }),
        );
        this._done(this);
        return this;
    }

    public doneAndPinStatus(inputs: { desc: string | undefined; icon: string | undefined }): Job {
        if (this.progress === 100) {
            throw new Error(`Operation ${this.uuid} has been done already. Desc: ${this.desc}`);
        }
        this.progress = 100;
        this.pinned = true;
        this.icon = typeof inputs.icon === 'string' ? inputs.icon : this.icon;
        if (this.icon !== undefined) {
            this.desc = `${typeof inputs.desc === 'string' ? inputs.desc : 'done'} in ${(
                (Date.now() - this._created) /
                1000
            ).toFixed(2)}s`;
        } else {
            this.desc = `${typeof inputs.desc === 'string' ? inputs.desc : this.desc} in ${(
                (Date.now() - this._created) /
                1000
            ).toFixed(2)}s`;
        }
        Events.IpcEvent.emit(
            new Events.State.Job.Event({
                uuid: this.uuid,
                session: this.session,
                desc: this.desc,
                progress: this.progress,
                pinned: this.pinned,
                icon: this.icon,
            }),
        );
        this._done(this);
        return this;
    }
}
