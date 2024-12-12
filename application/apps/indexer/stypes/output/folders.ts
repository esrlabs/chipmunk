export interface FolderEntityDetails {
    filename: string;
    full: string;
    path: string;
    basename: string;
    ext: string;
}
export interface FolderEntity {
    name: string;
    fullname: string;
    kind: FolderEntityType;
    details: FolderEntityDetails | null;
}
export interface FoldersScanningResult {
    list: FolderEntity[];
    max_len_reached: boolean;
}
export enum FolderEntityType {
    BlockDevice,
    CharacterDevice,
    Directory,
    FIFO,
    File,
    Socket,
    SymbolicLink,
}
