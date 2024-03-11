import { Define, Interface, SignatureRequirement } from '../declarations';
import { SharingSettings } from '../../../types/github';

import * as validator from '../../../env/obj';

@Define({ name: 'AddGitHubRepoRequest' })
export class Request extends SignatureRequirement {
    public owner: string;
    public repo: string;
    public token: string;
    public branch: string;
    public settings: SharingSettings;

    constructor(input: {
        branch: string;
        token: string;
        repo: string;
        owner: string;
        settings: SharingSettings;
    }) {
        super();
        validator.isObject(input);
        this.token = validator.getAsNotEmptyString(input, 'token');
        this.repo = validator.getAsNotEmptyString(input, 'repo');
        this.owner = validator.getAsNotEmptyString(input, 'owner');
        this.branch = validator.getAsNotEmptyString(input, 'branch');
        this.settings = validator.getAsObj(input, 'settings');
        this.settings.bookmarks = validator.getAsBool(input.settings, 'bookmarks');
        this.settings.charts = validator.getAsBool(input.settings, 'charts');
        this.settings.filters = validator.getAsBool(input.settings, 'filters');
        this.settings.comments = validator.getAsBool(input.settings, 'comments');
    }
}
export interface Request extends Interface {}

@Define({ name: 'AddGitHubRepoResponse' })
export class Response extends SignatureRequirement {
    public error?: string;
    public uuid?: string;

    constructor(input: { uuid?: string; error?: string }) {
        super();
        validator.isObject(input);
        this.uuid = validator.getAsNotEmptyStringOrAsUndefined(input, 'uuid');
        this.error = validator.getAsNotEmptyStringOrAsUndefined(input, 'error');
    }
}

export interface Response extends Interface {}
