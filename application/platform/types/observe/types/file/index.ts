export abstract class Support {
    public abstract getSupportedFileType(): FileName[];
}

//TODO AAZ: Check if we need a file type for the plugins.
export enum FileType {
    PcapNG = 'PcapNG',
    PcapLegacy = 'PcapLegacy',
    Text = 'Text',
    Binary = 'Binary',
}

export function getFileTypeFrom(smth: unknown): FileType | Error {
    switch (smth as FileType) {
        case FileType.Binary:
            return FileType.Binary;
        case FileType.PcapNG:
            return FileType.PcapNG;
        case FileType.PcapLegacy:
            return FileType.PcapLegacy;
        case FileType.Text:
            return FileType.Text;
        default:
            return new Error(`${smth} isn't FileType`);
    }
}

export function extname(filename: string): string {
    const matches = filename.match(/\.[\w\d_]*$/gi);
    if (matches !== null) {
        return matches[0];
    }
    return '';
}

export type FileName = string;
