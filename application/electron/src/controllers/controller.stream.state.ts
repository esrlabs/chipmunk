import Subject from '../tools/subject';

interface ISubjects {
    onStreamUpdated: Subject;
}

export default class State {

    private _subjects: ISubjects;
    private _streamId: string;

    constructor(streamId: string) {
        this._streamId = streamId;
        this._subjects = {
            onStreamUpdated: new Subject(`onStreamUpdated: ${streamId}`),
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
