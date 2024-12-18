import { Define, Interface, SignatureRequirement } from '../declarations';
import { Attachment } from '../../../types/content';
import { AttachmentInfo } from '../../../types/bindings';

import * as validator from '../../../env/obj';

@Define({ name: 'AttachmentsUpdated' })
export class Event extends SignatureRequirement {
    public session: string;
    public attachment: AttachmentInfo;
    public len: number;

    constructor(input: { session: string; attachment: AttachmentInfo; len: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.len = validator.getAsValidNumber(input, 'len');
        const attachment = validator.getAsObj(input, 'attachment');
        const err = Attachment.from(attachment);
        if (err instanceof Error) {
            throw err;
        }
        this.attachment = attachment;
    }
}

export interface Event extends Interface {}
