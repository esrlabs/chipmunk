import { Define, Interface, SignatureRequirement } from '../declarations';
import { ISettingsEntry } from '../../../types/settings/entry';

import * as validator from '../../../env/obj';

@Define({ name: 'SettingsEntriesRequest' })
export class Request extends SignatureRequirement {}

export interface Request extends Interface {}

@Define({ name: 'SettingsEntriesResponse' })
export class Response extends SignatureRequirement {
    public entries: ISettingsEntry[];
    constructor(input: { entries: ISettingsEntry[] }) {
        super();
        validator.isObject(input);
        this.entries = validator.getAsArray<ISettingsEntry>(input, 'entries');
    }
}

export interface Response extends Interface {}
