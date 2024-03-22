import { Define, Interface, SignatureRequirement } from '../declarations';
import { SharingSettings } from '../../../types/github';

import * as validator from '../../../env/obj';

@Define({ name: 'UpdateGitHubRepoRequest' })
export class Request extends SignatureRequirement {
    public uuid: string;
    public owner: string;
    public repo: string;
    public token: string;
    public branch: string;
    public entry: string | undefined;
    public settings: SharingSettings;

    constructor(input: {
        branch: string;
        uuid: string;
        token: string;
        repo: string;
        owner: string;
        entry: string | undefined;
        settings: SharingSettings;
    }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyString(input, 'uuid');
        this.token = validator.getAsNotEmptyString(input, 'token');
        this.repo = validator.getAsNotEmptyString(input, 'repo');
        this.owner = validator.getAsNotEmptyString(input, 'owner');
        this.branch = validator.getAsNotEmptyString(input, 'branch');
        this.entry = validator.getAsNotEmptyStringOrAsUndefined(input, 'entry');
        this.settings = validator.getAsObj(input, 'settings');
        this.settings.bookmarks = validator.getAsBool(input.settings, 'bookmarks');
        this.settings.charts = validator.getAsBool(input.settings, 'charts');
        this.settings.filters = validator.getAsBool(input.settings, 'filters');
        this.settings.comments = validator.getAsBool(input.settings, 'comments');
    }
}
export interface Request extends Interface {}

@Define({ name: 'UpdateGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public error?: string;

    constructor(input: { error?: string }) {
        super();
        validator.isObject(input);
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
