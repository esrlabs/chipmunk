import { SetupService, Interface, Implementation, register } from '@platform/entity/service';
import { services } from '@register/services';
import { bridge } from '@service/bridge';
import { session } from '@service/session';
import { Changelog } from '@tabs/changelogs/component';
import { unique } from '@platform/env/sequence';

const STORAGE_KEY = 'changelog_checks_state';

@SetupService(services['changelogs'])
export class Service extends Implementation {
    public async check(): Promise<void> {
        const current = await bridge.app().version();
        const checked = await bridge.storage(STORAGE_KEY).read();
        if (checked === current) {
            return;
        }
        const data = await bridge.app().changelogs(current);
        if (data.markdown.trim() === '') {
            return;
        }
        await bridge.storage(STORAGE_KEY).write(current);
        session.add().tab({
            name: `Release Notes ${data.version}`,
            active: true,
            closable: true,
            content: {
                factory: Changelog,
                inputs: {
                    markdown: data.markdown,
                    version: data.version,
                },
            },
            uuid: unique(),
        });
    }
}
export interface Service extends Interface {}
export const changelogs = register(new Service());
