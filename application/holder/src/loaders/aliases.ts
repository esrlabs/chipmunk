import moduleAlias from 'module-alias';
import * as path from 'path';

// Local root: application/holder/dist
const MODULES: { [key: string]: string } = {
    '@platform': 'platform',
    '@register': 'holder/src/register',
    '@env': 'holder/src/env',
    '@module': 'holder/src/modules',
    '@loader': 'holder/src/loaders',
    '@log': 'holder/src/env/logs',
    '@controller': 'holder/src/controller',
    '@service': 'holder/src/service',
    '@rc_api': 'node_modules/rustcore/dist/apps/rustcore/ts-bindings/src/api',
    '@rc_executors': 'node_modules/rustcore/dist/apps/rustcore/ts-bindings/src/api/executors',
    '@rc_interfaces': 'node_modules/rustcore/dist/apps/rustcore/ts-bindings/src/interfaces',
    '@rc_native': 'node_modules/rustcore/dist/apps/rustcore/ts-bindings/src/native',
    '@rc_provider': 'node_modules/rustcore/dist/apps/rustcore/ts-bindings/src/provider',
    '@rc_services': 'node_modules/rustcore/dist/apps/rustcore/ts-bindings/src/services',
    '@rc_util': 'node_modules/rustcore/dist/apps/rustcore/ts-bindings/src/util',
};

const ROOT_PATH = (function () {
    return __dirname.replace('/holder/src/loaders', '');
})();

function getModulePath(str: string): string {
    return path.resolve(ROOT_PATH, str);
}

export function setup() {
    const modules: { [key: string]: string } = {};
    Object.keys(MODULES).forEach((mod) => {
        modules[mod] = getModulePath(MODULES[mod]);
    });
    moduleAlias.addAliases(modules);
}

setup();
