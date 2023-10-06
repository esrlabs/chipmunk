import { Description, Visibility, Render } from 'platform/types/settings/entry.description';
import { Entry } from 'platform/types/settings/entry';

import * as validators from 'platform/types/storage/storage.record.validators';

export const settings = {
    match: new Entry(
        new Description({
            key: 'match',
            name: 'Match Color',
            desc: 'Default color for match; used to highlight matching on active search',
            path: 'general.colors',
            type: Visibility.standard,
            allowEmpty: true,
            render: Render.Color,
        }),
        new validators.AnyStringOrUndefined(undefined),
    ),
    default_filter: new Entry(
        new Description({
            key: 'default_filter',
            name: 'Default Filter Color',
            desc: 'Default color for just created filter',
            path: 'general.colors',
            type: Visibility.standard,
            allowEmpty: true,
            render: Render.Color,
        }),
        new validators.AnyStringOrUndefined(undefined),
    ),
    default_chart: new Entry(
        new Description({
            key: 'default_chart',
            name: 'Default Chart Color',
            desc: 'Default color for just created chart',
            path: 'general.colors',
            type: Visibility.standard,
            allowEmpty: true,
            render: Render.Color,
        }),
        new validators.AnyStringOrUndefined(undefined),
    ),
};
