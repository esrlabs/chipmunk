import Subject from '../../tools/subject';
import { IRange } from '../stream.main/file.map';

interface ISubjects {
    onStreamBytesMapUpdated: Subject<IRange>;
}

export class EventsHub {

    private _subjects: ISubjects;
    private _streamId: string;

    constructor(streamId: string) {
        this._streamId = streamId;
        this._subjects = {
            onStreamBytesMapUpdated: new Subject(`onStreamBytesMapUpdated: ${streamId}`),
        };
    }

    public destroy() {
        Object.keys(this._subjects).forEach((key: string) => {
            (this._subjects as any)[key].destroy();
        });
    }

    public getSubject(): ISubjects {
        return this._subjects;
    }

}
