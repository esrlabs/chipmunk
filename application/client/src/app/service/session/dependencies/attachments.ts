import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { cutUuid } from '@log/index';
import { Attachment } from '@platform/types/content';

// import * as Requests from '@platform/ipc/request';
import * as Events from '@platform/ipc/event';

@SetupLogger()
export class Attachments extends Subscriber {
    public readonly subjects: Subjects<{
        updated: Subject<number>;
    }> = new Subjects({
        updated: new Subject<number>(),
    });
    public readonly attachments: Map<string, Attachment> = new Map();
    private _len: number = 0;
    private _uuid!: string;

    public init(uuid: string) {
        this.setLoggerName(`Attachments: ${cutUuid(uuid)}`);
        this._uuid = uuid;
        this.register(
            Events.IpcEvent.subscribe(Events.Stream.Attachment.Event, (event) => {
                if (event.session !== this._uuid) {
                    return;
                }
                if (this.attachments.has(event.attachment.uuid)) {
                    this.log().error(
                        `Attachment ${event.attachment.uuid} already exist; attachment: ${event.attachment.name}(${event.attachment.filename})`,
                    );
                    return;
                }
                this.attachments.set(event.attachment.uuid, event.attachment);
                if (this.attachments.size !== event.len) {
                    this.log().warn(
                        `Count of attachment on backend dismatch with attachments on frontend`,
                    );
                }
                this.subjects.get().updated.emit(this.attachments.size);
            }),
        );
    }

    public destroy() {
        this.unsubscribe();
        this.subjects.destroy();
    }

    public len(): number {
        return this._len;
    }
}
export interface Attachments extends LoggerInterface {}
