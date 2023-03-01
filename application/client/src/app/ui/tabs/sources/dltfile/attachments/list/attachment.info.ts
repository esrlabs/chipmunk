import * as wasm from '@loader/wasm';
import { Attachment } from '@platform/types/parsers/dlt';

import { Matchee } from '@module/matcher';

export class AttachmentInfo extends Matchee {
    public readonly path: string;
    public readonly attachment: Attachment;

    static matcher: wasm.Matcher;

    constructor(path: string, attachment: Attachment, matcher: wasm.Matcher) {
        super(matcher, { name: attachment.name });
        AttachmentInfo.matcher = matcher;
        this.path = path;
        this.attachment = attachment;
    }

    public hidden(): boolean {
        return this.getScore() === 0;
    }

    public get html(): {
        name: string;
        size: string;
    } {
        const name: string | undefined = this.getHtmlOf('html_name');
        const size: string | undefined = this.getHtmlOf('html_size');
        return {
            name: name === undefined ? this.attachment.name : name,
            size: size === undefined ? this.attachment.size + " bytes" : size,
        };
    }
}
