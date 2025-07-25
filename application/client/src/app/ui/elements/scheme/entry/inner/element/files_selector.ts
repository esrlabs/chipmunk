import { ElementInner, FieldCategory } from './inner';
import { Value, ValueInput } from '@platform/types/bindings';

export enum FilesFoldersSelectorTarget {
    File,
    Files,
    Folder,
    Folders,
}

export class FilesFolderSelectorElement extends ElementInner {
    public value: string[] = [];

    constructor(
        public readonly target: FilesFoldersSelectorTarget,
        public readonly exts: string[],
        defaults: string | null | undefined,
    ) {
        super();
        if (target == FilesFoldersSelectorTarget.Folder) {
            this.value = [defaults ? defaults : ''];
        }
    }

    public getInnerValue(): any {
        return this.value;
    }

    public setValue(value: any) {
        this.value = value;
    }

    public getFieldCategory(): FieldCategory {
        return FieldCategory.Row;
    }

    public getValue(): Value {
        switch (this.target) {
            case FilesFoldersSelectorTarget.File:
            case FilesFoldersSelectorTarget.Folder:
                return { File: this.value[0] == undefined ? '' : this.value[0] };
            case FilesFoldersSelectorTarget.Files:
            case FilesFoldersSelectorTarget.Folders:
                return { Files: this.value };
        }
    }
}

export function tryFromOrigin(origin: ValueInput): FilesFolderSelectorElement | undefined {
    if (typeof origin === 'string' && origin === 'Directories') {
        return new FilesFolderSelectorElement(FilesFoldersSelectorTarget.Folders, [], undefined);
    } else if ((origin as { Directory: string | null }).Directory) {
        return new FilesFolderSelectorElement(
            FilesFoldersSelectorTarget.Folder,
            [],
            (origin as { Directory: string | null }).Directory,
        );
    } else if ((origin as { File: string[] }).File) {
        return new FilesFolderSelectorElement(
            FilesFoldersSelectorTarget.File,
            (origin as { File: string[] }).File,
            undefined,
        );
    } else if ((origin as { Files: string[] }).Files) {
        return new FilesFolderSelectorElement(
            FilesFoldersSelectorTarget.Files,
            (origin as { Files: string[] }).Files,
            undefined,
        );
    } else {
        return undefined;
    }
}
