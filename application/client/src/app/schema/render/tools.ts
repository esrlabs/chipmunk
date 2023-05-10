import { Implementation as Dlt } from './dlt';
import { Implementation as SomeIp } from './someip';
import { Implementation as Text } from './text';
import { Render } from './index';
import { Columns } from './columns';
import { Session } from '@service/session/session';

export enum Alias {
    dlt = 'dlt',
    someip = 'someip',
    text = 'text',
}

export function getRenderFor(): {
    dlt(): Render<Columns>;
    someip(): Render<Columns>;
    text(): Render<void>;
    any(): Render<void>;
} {
    return {
        dlt: (): Render<Columns> => {
            return new Dlt();
        },
        someip: (): Render<Columns> => {
            return new SomeIp();
        },
        text: (): Render<void> => {
            return new Text();
        },
        any: (): Render<void> => {
            return new Text();
        },
    };
}

export function getRenderAlias(smth: Session | Render<any>): Alias | Error {
    if (smth instanceof Session) {
        if (smth.render instanceof Dlt) {
            return Alias.dlt;
        } else if (smth.render instanceof Text) {
            return Alias.text;
        } else {
            return new Error(`Fail to detect render assigned with given session`);
        }
    } else {
        if (smth instanceof Dlt) {
            return Alias.dlt;
        } else if (smth instanceof Text) {
            return Alias.text;
        } else {
            return new Error(`Fail to detect render`);
        }
    }
}

export function isRenderMatch(session: Session, render: Render<any>): boolean | Error {
    const assigned = getRenderAlias(session);
    const checking = getRenderAlias(render);
    if (assigned instanceof Error) {
        return assigned;
    }
    if (checking instanceof Error) {
        return checking;
    }
    return assigned === checking;
}
