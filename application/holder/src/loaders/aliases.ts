import moduleAlias from 'module-alias';
import * as path from 'path';

const MODULES: { [key: string]: string } = {
    '@register': 'register',
    '@env': 'env',
    '@module': 'modules',
    '@loader': 'loaders',
    '@log': 'env/logs',
    '@controller': 'controller',
    '@service': 'service',
    // '@platform': '../node_modules/platform/dist',
    // '@rc_api': 'node_modules/rustcore/dist/api',
    // '@rc_executors': 'node_modules/rustcore/dist/api/executors',
    // '@rc_interfaces': 'node_modules/rustcore/dist/interfaces',
    // '@rc_native': 'node_modules/rustcore/dist/native',
    // '@rc_provider': 'node_modules/rustcore/dist/provider',
    // '@rc_services': 'node_modules/rustcore/dist/services',
    // '@rc_util': 'node_modules/rustcore/dist/util',
};
const ROOT_PATH = (function () {
    return __dirname.replace(/loaders$/gi, '');
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
