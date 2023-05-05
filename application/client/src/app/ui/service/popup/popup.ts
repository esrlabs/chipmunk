import { unique } from '@platform/env/sequence';
import { Subjects, Subject } from '@platform/env/subscription';
import { IComponentDesc } from '@elements/containers/dynamic/component';

export enum Vertical {
    top = 'top',
    center = 'center',
    bottom = 'bottom',
}

export enum Horizontal {
    left = 'left',
    right = 'right',
    center = 'center',
}

export interface Position {
    vertical: Vertical;
    horizontal: Horizontal;
}

export interface PopupOptions {
    closable?: boolean;
    width?: number;
    position?: Position;
    closeOnKey?: string;
    closeOnBGClick?: boolean;
    uuid?: string;
}

export interface Options extends PopupOptions {
    component: IComponentDesc;
}

export class Popup {
    public subjects: Subjects<{
        opened: Subject<void>;
        closed: Subject<void>;
    }> = new Subjects({
        opened: new Subject<void>(),
        closed: new Subject<void>(),
    });

    public options: Options;
    public readonly uuid: string;

    protected readonly closer: (uuid: string) => void;

    constructor(options: Options, closer: (uuid: string) => void) {
        this.uuid = options.uuid === undefined ? unique() : options.uuid;
        this.options = options;
        this.closer = closer;
    }

    public destroy() {
        this.close();
        this.subjects.destroy();
    }

    public close(): void {
        this.closer(this.uuid);
    }
}
