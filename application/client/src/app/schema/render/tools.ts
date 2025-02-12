import { Implementation as Dlt } from './dlt';
import { Implementation as SomeIp } from './someip';
import { Implementation as Text } from './text';
import { Implementation as Plugin } from './plugin';
import { Render, RenderReference } from './index';
import { Session } from '@service/session/session';
import { Observe } from '@platform/types/observe';
import { plugins as pluginService } from '@service/plugins';

import * as Parsers from '@platform/types/observe/parser/index';

const RENDERS: {
    [key: string]: RenderReference<unknown>;
} = {
    [Parsers.Protocol.Dlt]: Dlt,
    [Parsers.Protocol.SomeIp]: SomeIp,
    [Parsers.Protocol.Text]: Text,
};

export async function getRender(observe: Observe): Promise<Render<unknown> | Error> {
    const protocol = observe.parser.instance.alias();
    // Render options on plugins can't be static because they must be retrieved
    // from the plugin itself.
    if (protocol === Parsers.Protocol.Plugin) {
        const config = observe.parser.as<Parsers.Plugin.Configuration>(
            Parsers.Plugin.Configuration,
        );

        if (config === undefined) {
            return new Error('No parser configurations for plugin.');
        }

        const pluginPath = config.configuration.plugin_path;
        const parser = await pluginService
            .listIntalled()
            .then((plugins) => plugins.find((p) => p.info.wasm_file_path === pluginPath));

        if (parser === undefined) {
            return new Error("Selected parser plugin does'n exit");
        }

        return new Plugin(parser);
    }

    const Ref = RENDERS[protocol];
    return Ref === undefined ? new Error(`No render has been found for "${protocol}"`) : new Ref();
}

export function getLinkedProtocol(smth: Session | Render<any>): Parsers.Protocol | Error {
    return smth instanceof Session ? smth.render.protocol() : smth.protocol();
}

export function isRenderMatch(session: Session, render: Render<unknown>): boolean | Error {
    const assigned = getLinkedProtocol(session);
    return assigned === render.protocol();
}
