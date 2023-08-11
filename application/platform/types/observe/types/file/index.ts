export abstract class Support {
    public abstract getSupportedFileType(): FileName[];
}

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

export function getFileTypeByFilename(filename: string): FileType {
    switch (extname(filename).toLowerCase()) {
        case '.dlt':
            return FileType.Binary;
        case '.pcapng':
            return FileType.PcapNG;
        case '.pcap':
            return FileType.PcapLegacy;
        default:
            return FileType.Text;
    }
}

export type FileName = string;
