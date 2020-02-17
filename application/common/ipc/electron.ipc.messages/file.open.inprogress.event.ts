import { IStreamSourceNew } from './stream.source.new';

export interface IFileOpenInprogressEvent {
    file: string;
    session: string;
}

export class FileOpenInprogressEvent {

    public static signature: string = 'FileOpenInprogressEvent';
    public signature: string = FileOpenInprogressEvent.signature;
    public file: string = '';
    public session: string = '';

    constructor(params: IFileOpenInprogressEvent) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileOpenInprogressEvent message`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        this.file = params.file;
        this.session = params.session;
    }
}
