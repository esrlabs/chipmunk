import { error } from '../log/utils';
import { Mutable } from './unity/mutable';

import * as obj from '../env/obj';

export interface IGrabbedContent {
    grabbed_elements: IGrabbedElement[];
}

/**
 * Output for @grabStreamChunk method of session
 * (application/apps/rustcore/ts/src/native/native.session.ts)
 */
export interface IGrabbedElement {
    source_id: number;
    content: string;
    position: number;
    nature: number;
}

export enum IndexingMode {
    Regular = 0,
    Breadcrumbs = 1,
}

export enum NatureTypes {
    Search = 0,
    Bookmark = 1,
    Breadcrumb = 2,
    BreadcrumbSeporator = 3,
}

export class Nature {
    static getBits(int: number, len: number): number[] {
        const bits = [];
        for (let i = len - 1; i > -1; --i) {
            bits.push(0x01 & (int >> i));
        }
        return bits;
    }

    protected readonly bits: number[];
    public hidden: number = 0;
    public readonly match: boolean;
    public readonly bookmark: boolean;
    public readonly breadcrumb: boolean;
    public readonly seporator: boolean;

    constructor(int: number) {
        this.bits = Nature.getBits(int, 8);
        this.match = this.isMatch();
        this.bookmark = this.isBookmark();
        this.breadcrumb = this.isBreadcrumb();
        this.seporator = this.isSeporator();
    }

    protected isMatch(): boolean {
        return this.bits[7] === 1;
    }

    protected isBookmark(): boolean {
        return this.bits[6] === 1;
    }

    protected isBreadcrumb(): boolean {
        return this.bits[1] === 1;
    }

    protected isSeporator(): boolean {
        return this.bits[0] === 1;
    }

    public getTypes(): NatureTypes[] {
        const types: NatureTypes[] = [];
        if (this.match) {
            types.push(NatureTypes.Search);
        }
        if (this.bookmark) {
            types.push(NatureTypes.Bookmark);
        }
        if (this.breadcrumb) {
            types.push(NatureTypes.Breadcrumb);
        }
        if (this.seporator) {
            types.push(NatureTypes.BreadcrumbSeporator);
        }
        return types;
    }
}

export interface IAttachment {
    uuid: string;
    filepath: string;
    name: string;
    ext: string | undefined;
    size: number;
    mime: string | undefined;
    messages: number[];
}

export class Attachment {
    public readonly uuid: string;
    public readonly filepath: string;
    public readonly name: string;
    public readonly ext: string | undefined;
    public readonly size: number;
    public readonly mime: string | undefined;
    public readonly messages: number[];
    public readonly color: string | undefined;

    static from(smth: string | unknown): Attachment | Error {
        try {
            if (typeof smth === 'string') {
                smth = JSON.parse(smth);
            }
            return new Attachment({
                uuid: obj.getAsString(smth, 'uuid'),
                filepath: obj.getAsString(smth, 'filepath'),
                name: obj.getAsString(smth, 'name'),
                ext: obj.getAsNotEmptyStringOrAsUndefined(smth, 'ext'),
                size: obj.getAsValidNumber(smth, 'size'),
                mime: obj.getAsNotEmptyStringOrAsUndefined(smth, 'mime'),
                messages: obj.getAsArray(smth, 'messages'),
            });
        } catch (e) {
            return new Error(error(e));
        }
    }

    constructor(attachment: IAttachment) {
        this.uuid = attachment.uuid;
        this.filepath = attachment.filepath;
        this.name = attachment.name;
        this.ext = attachment.ext;
        this.size = attachment.size;
        this.mime = attachment.mime;
        this.messages = attachment.messages;
    }

    public setColor(color: string): void {
        (this as Mutable<Attachment>).color = color;
    }

    public extAsString(): string {
        return typeof this.ext === 'string' ? this.ext : '';
    }

    public is(): {
        image(): boolean;
        video(): boolean;
        audio(): boolean;
        text(): boolean;
    } {
        return {
            image: (): boolean => {
                if (typeof this.mime !== 'string') {
                    return false;
                }
                return this.mime.toLowerCase().includes('image');
            },
            video: (): boolean => {
                if (typeof this.mime !== 'string') {
                    return false;
                }
                return this.mime.toLowerCase().includes('video');
            },
            audio: (): boolean => {
                if (typeof this.mime !== 'string') {
                    return false;
                }
                return this.mime.toLowerCase().includes('audio');
            },
            text: (): boolean => {
                if (typeof this.mime !== 'string') {
                    return false;
                }
                return this.mime.toLowerCase().includes('text');
            },
        };
    }
}
