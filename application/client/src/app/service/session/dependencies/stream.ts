import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subject } from '@platform/env/subscription';
import { Range } from '@platform/types/range';
import { ilc, Emitter, Channel, Declarations, Services } from '@service/ilc';
import { cutUuid } from '@log/index';
import { Rank } from './rank';
import { IGrabbedElement } from '@platform/types/content';

import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

@SetupLogger()
export class Stream {
    private readonly _subscriber: Subscriber = new Subscriber();
    private _len: number = 0;
    private _uuid!: string;
    private _emitter!: Emitter;

    public rank: Rank = new Rank();

    public init(uuid: string) {
        this.setLoggerName(`Stream: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this._emitter = ilc.emitter(this.getLoggerName(), this.log());
        this._subscriber.register(
            Events.IpcEvent.subscribe(Events.Stream.Updated.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                this._len = event.rows;
                this._emitter.session.stream.updated({
                    session: this._uuid,
                    len: this._len,
                });
                if (this.rank.set(this._len.toString().length)) {
                    this._emitter.ui.row.rank({
                        len: this.rank.len,
                        session: this._uuid,
                    });
                }
            }),
        );
    }

    public destroy() {
        this._subscriber.unsubscribe();
    }

    public len(): number {
        return this._len;
    }

    public chunk(range: Range): Promise<IGrabbedElement[]> {
        if (this._len === 0) {
            // TODO: Grabber is crash session in this case... should be prevented on grabber level
            return Promise.resolve([]);
        }
        return new Promise((resolve) => {
            Requests.IpcRequest.send(
                Requests.Stream.Chunk.Response,
                new Requests.Stream.Chunk.Request({
                    session: this._uuid,
                    from: range.from,
                    to: range.to,
                }),
            )
                .then((response: Requests.Stream.Chunk.Response) => {
                    resolve(response.rows);
                })
                .catch((error: Error) => {
                    this.log().error(`Fail to grab content: ${error.message}`);
                });
        });
    }
}
export interface Stream extends LoggerInterface {}
