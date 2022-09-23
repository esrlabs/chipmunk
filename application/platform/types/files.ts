import { IDLTOptions } from './parsers/dlt';

export enum EntityType {
    BlockDevice = 0,
    CharacterDevice = 1,
    Directory = 2,
    FIFO = 3,
    File = 4,
    Socket = 5,
    SymbolicLink = 6,
}

export interface Entity {
    name: string;
    type: EntityType;
    details?: {
        filename: string;
        path: string;
        basename: string;
        ext: string;
    };
}

export interface File {
    name: string;
    ext: string;
    path: string;
    filename: string;
    type: FileType;
    stat: Stat;
}

export enum FileType {
    Text = 'Text',
    Dlt = 'Dlt',
    SomeIP = 'SomeIP',
    Pcap = 'Pcap',
    Any = 'Any',
}

export interface TargetFileOptions {
    dlt?: IDLTOptions;
    someip?: Record<string, unknown>;
    pcap?: Record<string, unknown>;
}

export interface TargetFile {
    filename: string;
    name: string;
    type: FileType;
    options: TargetFileOptions;
}

export interface Stat {
    dev: number;
    ino: number;
    mode: number;
    nlink: number;
    uid: number;
    gid: number;
    rdev: number;
    size: number;
    blksize: number;
    blocks: number;
    atimeMs: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;
}

const FILE_NAME_REG = /[^/\\]*$/gi;
const FILE_EXT_REG = /[^/\\\.]*$/gi;
export function getFileName(filename: string): string {
    const match = FILE_NAME_REG.exec(filename);
    if (match === null) {
        return filename;
    }
    FILE_NAME_REG.lastIndex = 0;
    return match[0];
}

export function getParentFolder(filename: string): string {
    const name = getFileName(filename);
    return filename.replace(name, '').replace(/[/\\]$/gi, '');
}

export function getFileExtention(filename: string): string {
    const match = FILE_EXT_REG.exec(filename);
    if (match === null) {
        return '';
    }
    FILE_EXT_REG.lastIndex = 0;
    return match[0];
}
