import { Define, Interface, SignatureRequirement } from '../declarations';
import { IAttachment, Attachment } from '../../../types/content';

import * as validator from '../../../env/obj';

@Define({ name: 'AttachmentsUpdated' })
export class Event extends SignatureRequirement {
    public session: string;
    public attachment: IAttachment;
    public len: number;

    constructor(input: { session: string; attachment: IAttachment; len: number }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyString(input, 'session');
        this.len = validator.getAsValidNumber(input, 'len');
        const attachment = Attachment.from(validator.getAsObj(input, 'attachment'));
        if (attachment instanceof Error) {
            throw attachment;
        }
        this.attachment = attachment;
    }
}

export interface Event extends Interface {}
