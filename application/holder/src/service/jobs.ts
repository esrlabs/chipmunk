import { SetupService, Interface, Implementation, register } from 'platform/entity/service';
import { services } from '@register/services';
import { Job } from './jobs/job';

export { Job };
export * as aliases from './jobs/aliases';

@SetupService(services['jobs'])
export class Service extends Implementation {
    private _jobs: Map<string, Map<string, Job>> = new Map();

    public create(inputs: {
        pinned: boolean;
        uuid?: string;
        session?: string;
        desc?: string;
    }): Job {
        const job = new Job({
            uuid: inputs.uuid,
            session: inputs.session,
            desc: inputs.desc,
            pinned: inputs.pinned,
            done: (job: Job) => {
                const jobs = this._jobs.get(job.session);
                if (jobs === undefined) {
                    return;
                }
                jobs.delete(job.uuid);
            },
        });
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
