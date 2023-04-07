import { version } from './version';
import { net } from './net';
import { scope } from 'platform/env/scope';
import { error } from 'platform/log/utils';

export async function init(): Promise<void> {
    const logger = scope.getLogger('modules');
    let errors = 0;
    let count = 0;
    for (const mod of [version, net]) {
        try {
            logger.debug(`initing "${mod.getName()}"`);
            await mod.init();
            logger.debug(`"${mod.getName()}" is inited`);
            count += 1;
        } catch (err) {
            logger.debug(`fail to init "${mod.getName()}": ${error(err)}`);
            errors += 1;
        }
    }
    logger.debug(`All modules are inited (inited: ${count}; errors: ${errors})...`);
}
