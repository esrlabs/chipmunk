export abstract class Support {
    public abstract getSupportedFileType(): FileName[];
}

export enum FileType {
    PcapNG = 'PcapNG',
    Text = 'Text',
    Binary = 'Binary',
}

export function getFileTypeFrom(smth: unknown): FileType | Error {
    switch (smth as FileType) {
        case FileType.Binary:
            return FileType.Binary;
        case FileType.PcapNG:
            return FileType.PcapNG;
        case FileType.Text:
            return FileType.Text;
        default:
            return new Error(`${smth} isn't FileType`);
    }
}

export type FileName = string;
