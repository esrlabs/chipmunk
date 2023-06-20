import { Destroy } from '@platform/types/env/types';
import { IlcInterface } from '@service/ilc';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Subscriber } from '@platform/env/subscription';
import { Session } from '@service/session';
import { Cursor } from './cursor';

export class State extends Subscriber implements Destroy {
    public static REDUCE_MOVE_ON_WHEEL = 5;
    public static REDUCE_ZOOM_ON_WHEEL = 3;
    public static KEY_MOVE_STEP = 15;

    protected session!: Session;

    public ref!: IlcInterface & ChangesDetector;
    public cursor: Cursor = new Cursor();
    public hasData: boolean = false;

    public destroy(): void {
        this.unsubscribe();
        this.cursor.destroy();
    }

    public init(ref: IlcInterface & ChangesDetector, session: Session): void {
        this.ref = ref;
        this.session = session;
        this.register(
            session.stream.subjects.get().updated.subscribe((len: number) => {
                this.cursor.setStreamLen(len);
            }),
            session.charts.subjects.get().summary.subscribe((_event) => {
                this.hasData = this.session.charts.hasData();
                this.ref.detectChanges();
            }),
            session.charts.subjects.get().output.subscribe((_event) => {
                this.hasData = this.session.charts.hasData();
                this.ref.detectChanges();
            }),
        );
        this.cursor.init(session);
    }
}
