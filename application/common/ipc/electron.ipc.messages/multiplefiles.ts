export interface IFile {
    lastModified: number;
    lastModifiedDate: Date;
    name: string;
    path: string;
    size: number;
    type: string;
    hasParser: boolean;
    isHidden: boolean;
    checked: boolean;
    disabled: boolean;
}

export class Multiplefiles {
    public static signature: string = 'Multiplefiles';
    public signature: string = Multiplefiles.signature;
    public files: IFile[];

    constructor(files: IFile[]) {
        if (typeof files !== 'object' || files === null) {
            throw new Error(`Incorrect parameters for Multiplefiles message`);
        }
        this.files = files;
    }
}
