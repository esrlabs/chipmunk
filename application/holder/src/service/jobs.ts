import { SetupService, Interface, Implementation, register } from 'platform/entity/service';
import { services } from '@register/services';
import { Job } from './jobs/job';
import { electron } from '@service/electron';
import { LockToken } from 'platform/env/lock.token';

export { Job };
export * as aliases from './jobs/aliases';

@SetupService(services['jobs'])
export class Service extends Implementation {
    public locked: LockToken = LockToken.simple(false);

    private _jobs: Map<string, Map<string, Job>> = new Map();

    public override ready(): Promise<void> {
        electron.subjects.get().closing.subscribe(() => {
            this._jobs.forEach((jobs) => jobs.forEach((job) => job.cancel()));
            this.locked.lock();
        });
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this._jobs.clear();
        return Promise.resolve();
    }

    public create(inputs: {
        uuid?: string;
        session?: string;
        name?: string;
        desc?: string;
        icon?: string;
    }): Job {
        const job = new Job({
            uuid: inputs.uuid,
            session: inputs.session,
            name: inputs.name,
            desc: inputs.desc,
            icon: inputs.icon,
            done: (job: Job) => {
                const jobs = this._jobs.get(job.session);
                if (jobs === undefined) {
                    return;
                }
                jobs.delete(job.uuid);
            },
        });
        if (this.locked.isLocked()) {
            job.cancel();
        }
        let jobs = this._jobs.get(job.session);
        if (jobs === undefined) {
            jobs = new Map();
        }
        jobs.set(job.uuid, job);
        this._jobs.set(job.session, jobs);
        return job;
    }

    public find(uuid: string): Job | undefined {
        let target: Job | undefined;
        Array.from(this._jobs.values()).forEach((jobs) => {
            if (target !== undefined) {
                return;
            }
            target = Array.from(jobs.values()).find((j) => j.uuid === uuid);
        });
        return target;
    }
}
export interface Service extends Interface {}
export const jobs = register(new Service());
