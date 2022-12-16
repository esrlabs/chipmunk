import { Description, Visibility, Render } from 'platform/types/settings/entry.description';
import { Entry } from 'platform/types/settings/entry';

import * as validators from 'platform/types/storage/storage.record.validators';

export const settings = {
    proxy: new Entry(
        new Description({
            key: 'proxy',
            name: 'Proxy',
            desc: 'Default values would be taken from the http_proxy and https_proxy environment variables.',
            path: 'general.network',
            type: Visibility.standard,
            allowEmpty: true,
            render: Render.String,
        }),
        new validators.AnyStringOrUndefined(undefined),
    ),
    authorization: new Entry(
        new Description({
            key: 'authorization',
            name: 'Proxy-Authorization',
            desc: 'The value to send as the Proxy-Authorization header for every network request.',
            path: 'general.network',
            type: Visibility.standard,
            allowEmpty: true,
            render: Render.String,
        }),
        new validators.AnyStringOrUndefined(undefined),
    ),
    strictSSL: new Entry(
        new Description({
            key: 'strictSSL',
            name: 'Proxy Strict SSL',
            desc: 'Controls whether the proxy server certificate should be verified against the list of supplied CAs',
            path: 'general.network',
            type: Visibility.standard,
            allowEmpty: true,
            render: Render.Bool,
        }),
        new validators.BoolOrUndefined(false),
    ),
};
