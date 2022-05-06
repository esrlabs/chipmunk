import { IDLTOptions } from './dlt';

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
    someip?: {};
    pcap?: {};
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
