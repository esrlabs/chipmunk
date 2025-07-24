import * as obj from '../env/obj';

export abstract class Support {
    public abstract getSupportedFileType(): FileName[];
}

// TODO: remove it!
export enum FileType {
    PcapNG = 'PcapNG',
    PcapLegacy = 'PcapLegacy',
    Text = 'Text',
    Binary = 'Binary',
    ParserPlugin = 'ParserPlugin',
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
        case FileType.ParserPlugin:
            return FileType.ParserPlugin;
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

export enum EntityType {
    BlockDevice = 0,
    CharacterDevice = 1,
    Directory = 2,
    FIFO = 3,
    File = 4,
    Socket = 5,
    SymbolicLink = 6,
}

const EntityTypeRev: { [key: string]: EntityType } = {
    ['BlockDevice']: EntityType.BlockDevice,
    ['CharacterDevice']: EntityType.CharacterDevice,
    ['Directory']: EntityType.Directory,
    ['FIFO']: EntityType.FIFO,
    ['File']: EntityType.File,
    ['Socket']: EntityType.Socket,
    ['SymbolicLink']: EntityType.SymbolicLink,
};

export interface Entity {
    name: string;
    fullname: string;
    kind: EntityType;
    details?: {
        filename: string;
        full: string;
        path: string;
        basename: string;
        ext: string;
    };
}

export function entityFromObj(smth: { [key: string]: unknown }): Entity {
    if (typeof smth !== 'object') {
        throw new Error(`Not an object`);
    }
    const entityType = EntityTypeRev[obj.getAsNotEmptyString(smth, 'kind')];
    if (entityType === undefined) {
        throw new Error(`Unknown type: ${smth['kind']}`);
    }
    const entity: Entity = {
        name: obj.getAsNotEmptyString(smth, 'name'),
        fullname: obj.getAsNotEmptyString(smth, 'fullname'),
        kind: entityType,
        details: undefined,
    };
    if (smth['details'] !== null && typeof smth['details'] === 'object') {
        entity.details = {
            filename: obj.getAsNotEmptyString(smth['details'], 'filename'),
            full: obj.getAsNotEmptyString(smth['details'], 'full'),
            path: obj.getAsNotEmptyString(smth['details'], 'path'),
            basename: obj.getAsNotEmptyString(smth['details'], 'basename'),
            ext: obj.getAsString(smth['details'], 'ext'),
        };
    }
    return entity;
}

export interface File {
    name: string;
    ext: string;
    path: string;
    filename: string;
    type: FileType;
    stat: Stat;
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

export interface ParsedPath {
    name: string;
    filename: string;
    parent: string;
    ext: string;
}

const FILE_NAME_REG = /[^/\\]*$/gi;
const FILE_EXT_REG = /[^/\\.]*$/gi;

export function getFileName(filename: string): string {
    const match = FILE_NAME_REG.exec(filename);
    if (match === null) {
        return filename;
    }
    FILE_NAME_REG.lastIndex = 0;
    return match[0];
}

export function getSafeFileName(filename: string): string {
    return filename.replace(/[^\w\d\-.]/gi, '_');
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

export function appendFileExtention(filename: string, ext: string) {
    return `${filename}${ext.startsWith('.') || filename.endsWith('.') ? '' : '.'}${ext}`;
}
