import { Define, Interface, SignatureRequirement } from '../declarations';
import { Action } from '../../../types/notification';

import * as validator from '../../../env/obj';

@Define({ name: 'NotificationPop' })
export class Event extends SignatureRequirement {
    public session: string | undefined;
    public message: string;
    public actions: Action[];

    constructor(input: { session: string | undefined; message: string; actions: Action[] }) {
        super();
        validator.isObject(input);
        this.session = validator.getAsNotEmptyStringOrAsUndefined(input, 'session');
        this.message = validator.getAsNotEmptyString(input, 'message');
        this.actions = validator.getAsArray(input, 'actions');
    }
}

export interface Event extends Interface {}
