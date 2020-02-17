import { IStreamSourceNew } from './stream.source.new';

export interface IFileOpenDoneEvent {
    file: string;
    session: string;
    stream?: IStreamSourceNew;
    options?: any;
}

export class FileOpenDoneEvent {

    public static signature: string = 'FileOpenDoneEvent';
    public signature: string = FileOpenDoneEvent.signature;
    public file: string = '';
    public session: string = '';
    public options?: string = '';
    public stream?: IStreamSourceNew;

    constructor(params: IFileOpenDoneEvent) {
        if (typeof params !== 'object' || params === null) {
            throw new Error(`Incorrect parameters for FileOpenDoneEvent message`);
        }
        if (typeof params.file !== 'string' || params.file.trim() === '') {
            throw new Error(`file should be defined.`);
        }
        if (typeof params.session !== 'string' || params.session.trim() === '') {
            throw new Error(`session should be defined.`);
        }
        this.file = params.file;
        this.session = params.session;
        this.stream = params.stream;
        this.options = params.options;
    }
}
