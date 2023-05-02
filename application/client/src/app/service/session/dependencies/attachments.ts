import { SetupLogger, LoggerInterface } from '@platform/entity/logger';
import { Subscriber, Subjects, Subject } from '@platform/env/subscription';
import { cutUuid } from '@log/index';
import { Attachment } from '@platform/types/content';
import { getNextColor } from '@ui/styles/colors';

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

    protected readonly positions: Map<number, Attachment> = new Map();

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
                        `Attachment ${event.attachment.uuid} already exist; attachment: ${event.attachment.name}(${event.attachment.filepath})`,
                    );
                    return;
                }
                const attachment = Attachment.from(event.attachment);
                if (attachment instanceof Error) {
                    this.log().error(
                        `Fail to parse attachment ${event.attachment.uuid}; attachment: ${event.attachment.name}(${event.attachment.filepath})`,
                    );
                    return;
                }
                attachment.setColor(getNextColor());
                this.attachments.set(event.attachment.uuid, attachment);
                if (this.attachments.size !== event.len) {
                    this.log().warn(
                        `Count of attachment on backend dismatch with attachments on frontend`,
                    );
                }
                attachment.messages.forEach((pos) => {
                    this.positions.set(pos, attachment);
                });
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

    public has(position: number): boolean {
        return this.positions.has(position);
    }

    public getByPos(position: number): Attachment | undefined {
        return this.positions.get(position);
    }
}
export interface Attachments extends LoggerInterface {}
