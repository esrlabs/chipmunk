import {
    SetupService,
    Interface,
    Implementation,
    DependOn,
    register,
} from '@platform/entity/service';
import { electron } from '@service/electron';
import { jobs } from '@service/jobs';
import { services } from '@register/services';
import { Subscriber } from '@platform/env/subscription';
import { Session } from 'rustcore';
import { Active } from './sessions/active';

import * as RequestHandlers from './sessions/requests';
import * as Requests from '@platform/ipc/request';

@DependOn(jobs)
@DependOn(electron)
@SetupService(services['sessions'])
export class Service extends Implementation {
    private _subscriber: Subscriber = new Subscriber();
    private _sessions: Map<
        string,
        {
            session: Session;
            subscriber: Subscriber;
        }
    > = new Map();
    private _active: Active = new Active();

    public override ready(): Promise<void> {
        this._subscriber.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Session.Create.Request,
                    RequestHandlers.Session.Create.handler,
                ),
        );
        this._subscriber.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Stream.Chunk.Request,
                    RequestHandlers.Stream.Chunk.handler,
                ),
        );
        this._subscriber.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Search.Chunk.Request,
                    RequestHandlers.Search.Chunk.handler,
                ),
        );
        this._subscriber.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Search.Search.Request,
                    RequestHandlers.Search.Search.handler,
                ),
        );
        this._subscriber.register(
            electron
                .ipc()
                .respondent(
                    this.getName(),
                    Requests.Search.Drop.Request,
                    RequestHandlers.Search.Drop.handler,
                ),
        );
        return Promise.resolve();
    }

    public override destroy(): Promise<void> {
        this._subscriber.unsubscribe();
        return Promise.resolve();
    }

    public add(session: Session, subscriber: Subscriber) {
        this._sessions.set(session.getUUID(), {
            session,
            subscriber,
        });
    }

    public get(uuid: string):
        | undefined
        | {
              session: Session;
              subscriber: Subscriber;
          } {
        return this._sessions.get(uuid);
    }

    public setActive(uuid: string) {
        if (!this.exists(uuid)) {
            throw new Error(`Fail to set session ${uuid} active. it doesn't exist`);
        }
        this._active.set(uuid);
    }

    public exists(uuid: string): boolean {
        return this._sessions.has(uuid);
    }
}
export interface Service extends Interface {}
export const sessions = register(new Service());
