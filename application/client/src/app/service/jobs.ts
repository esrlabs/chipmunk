import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { Job } from './jobs/job';
import { services } from '@register/services';
import { ilc, Emitter } from '@service/ilc';

import * as Events from '@platform/ipc/event/index';

export { Job };

@SetupService(services['jobs'])
export class Service extends Implementation {
    private _emitter!: Emitter;
    private _jobs: Map<string, Map<string, Job>> = new Map();

    public override ready(): Promise<void> {
        this._emitter = ilc.emitter(this.getName(), this.log());
        this.register(
            Events.IpcEvent.subscribe<Events.State.Job.Event>(Events.State.Job.Event, (event) => {
                let job = this.find(event.uuid);
                if (job === undefined) {
                    job = new Job({
                        session: event.session,
                        uuid: event.uuid,
                        name: event.name,
                        desc: event.desc,
                        progress: event.progress,
                    });
                } else {
                    job.update(event);
                }
                let jobs = this._jobs.get(job.session);
                if (jobs === undefined) {
                    jobs = new Map();
                }
                jobs.set(job.uuid, job);
                this._jobs.set(job.session, jobs);
                this._emitter.backend.job(job);
            }),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this.unsubscribe();
        return Promise.resolve();
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

    public session(session: string): Job[] {
        const jobs = this._jobs.get(session);
        if (jobs === undefined) {
            return [];
        } else {
            return Array.from(jobs.values());
        }
    }

    public globals(): Job[] {
        const jobs = this._jobs.get(Job.GLOBAL_JOBS);
        if (jobs === undefined) {
            return [];
        } else {
            return Array.from(jobs.values());
        }
    }
}
export interface Service extends Interface {}
export const jobs = register(new Service());
