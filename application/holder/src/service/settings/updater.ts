import { Description, Visibility, Render } from 'platform/types/settings/entry.description';
import { Entry } from 'platform/types/settings/entry';

import * as validators from 'platform/types/storage/storage.record.validators';

export const settings = {
    autoUpdateCheck: new Entry(
        new Description({
            key: 'autoUpdateCheck',
            name: 'Auto update',
            desc: 'Chipmunk checks updates automatically on start',
            path: 'general',
            type: Visibility.standard,
            allowEmpty: true,
            render: Render.Bool,
        }),
        new validators.BoolOrUndefined(true),
    ),
};
