import { CommonInterfaces } from '../../interfaces/interface.common';

const CPluginInfoValidators: { [key: string] : { type: 'string' | 'boolean' | 'array' | 'object', defaults?: any } } = {
    name:           { type: 'string' },
    url:            { type: 'string' },
    version:        { type: 'string' },
    hash:           { type: 'string' },
    phash:          { type: 'string' },
    default:        { type: 'boolean', defaults: true },
    signed:         { type: 'boolean', defaults: false },
    dependencies:   { type: 'object' },
    display_name:   { type: 'string' },
    description:    { type: 'string' },
    readme:         { type: 'string' },
    icon:           { type: 'string' },
    file:           { type: 'string' },
    history:        { type: 'array', defaults: [] },
};

export function getPluginReleaseInfoFromStr(str: string): CommonInterfaces.Plugins.IPlugin | Error {
    try {
        const plugin: CommonInterfaces.Plugins.IPlugin = JSON.parse(str);
        if (typeof plugin !== 'object' || plugin === null) {
            return new Error(`Plugin info isn't object`);
        }
        return getValidPluginReleaseInfo(plugin);
    } catch (e) {
        return e;
    }
}

export function getValidPluginReleaseInfo(smth: any): CommonInterfaces.Plugins.IPlugin | Error {
    if (typeof smth !== 'object' || smth === null) {
        return new Error(`Plugin info isn't object`);
    }
    const errors: string[] = [];
    // Validate all properties
    Object.keys(CPluginInfoValidators).forEach((prop: string) => {
        let valid: boolean = true;
        if (CPluginInfoValidators[prop].type === 'array' && !((smth as any)[prop] instanceof Array)) {
            valid = false;
        } else if (CPluginInfoValidators[prop].type !== 'array' && typeof (smth as any)[prop] !== CPluginInfoValidators[prop].type) {
            valid = false;
        }
        if (!valid && CPluginInfoValidators[prop].defaults === undefined) {
            errors.push(`Property "${prop}" has incorrect value/type`);
        } else if (!valid && CPluginInfoValidators[prop].defaults !== undefined) {
            (smth as any)[prop] = CPluginInfoValidators[prop].defaults;
        }
    });
    if (errors.length > 0) {
        return new Error(errors.join('; '));
    }
    // Get rid of other properties
    const plugin: any = {};
    Object.keys(CPluginInfoValidators).forEach((prop: string) => {
        plugin[prop] = (smth as any)[prop];
    });
    return plugin as CommonInterfaces.Plugins.IPlugin;
}
