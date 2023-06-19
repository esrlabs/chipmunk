import { Implementation as Dlt } from './dlt';
import { Implementation as SomeIp } from './someip';
import { Implementation as Text } from './text';
import { Render, RenderReference } from './index';
import { Session } from '@service/session/session';
import { Observe } from '@platform/types/observe';

import * as Parsers from '@platform/types/observe/parser/index';

const RENDERS: {
    [key: string]: RenderReference<unknown>;
} = {
    [Parsers.Protocol.Dlt]: Dlt,
    [Parsers.Protocol.SomeIp]: SomeIp,
    [Parsers.Protocol.Text]: Text,
};

export function getRender(observe: Observe): Render<unknown> | Error {
    const protocol = observe.parser.instance.alias();
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
