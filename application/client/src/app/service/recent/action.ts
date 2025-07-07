import { Entry } from '@platform/types/storage/entry';
import { error } from '@platform/log/utils';
import { session } from '@service/session';
import { lockers, Locker } from '@ui/service/lockers';
import { Stat, IStat } from './stat';
import { recent } from '@service/recent';
import { scope } from '@platform/env/scope';
import { Logger } from '@platform/log';
import { SessionComponents, SessionOrigin } from '@service/session/origin';
import { ObserveOperation } from '@service/session/dependencies/stream';
import { SessionDescriptor, SessionSetup } from '@platform/types/bindings';
import { hash } from '@platform/env/hash';

import * as obj from '@platform/env/obj';

interface IActionContent {
    hash: string;
    stat: IStat;
    descriptor: SessionDescriptor;
    setup: SessionSetup;
}

export class Action {
    static from(entry: Entry): Action | Error {
        try {
            const body: IActionContent = JSON.parse(entry.content);
            if (body.setup === undefined || typeof body.setup !== 'object') {
                throw new Error(`No origin object. It might be old format. No converting support`);
            }
            obj.getAsObj(body.setup, 'origin');
            obj.getAsObj(body.setup, 'parser');
            obj.getAsObj(body.setup, 'source');
            if (body.descriptor === undefined || typeof body.descriptor !== 'object') {
                throw new Error(
                    `No descriptor object. It might be old format. No converting support`,
                );
            }
            obj.getAsObj(body.descriptor, 'p_desc');
            obj.getAsObj(body.descriptor, 's_desc');
            obj.getAsObj(body.descriptor, 'parser');
            obj.getAsObj(body.descriptor, 'source');
            return new Action(body.setup, body.descriptor, body.stat);
        } catch (err) {
            return new Error(`Fail to parse action: ${error(err)}`);
        }
    }

    static getSetupHash(setup: SessionSetup): string {
        return hash(JSON.stringify(setup)).toString();
    }

    static fromOperation(operation: ObserveOperation): Error | Action {
        const setup = operation.getOrigin().getSessionSetup();
        const descriptor = operation.getDescriptor();
        if (!descriptor) {
            return new Error(
                `Action ${JSON.stringify(setup.origin)} doesn't have session descriptor`,
            );
        }
        return new Action(setup, descriptor);
    }

    protected logger: Logger;

    public stat: Stat = Stat.defaults();
    public hash: string;

    constructor(
        public readonly setup: SessionSetup,
        public readonly descriptor: SessionDescriptor,
        stat?: IStat,
    ) {
        this.hash = Action.getSetupHash(this.setup);
        this.logger = scope.getLogger(`Action: ${this.hash}`);
        if (stat) {
            this.stat = new Stat(stat);
        }
    }

    public isSuitable(origin: SessionOrigin): boolean {
        if (!origin.isSameAction(this.setup.origin)) {
            return false;
        }
        if (!origin.components) {
            return false;
        }
        if (!origin.components.parser || !origin.components.source) {
            return false;
        }
        return (
            origin.components.parser.uuid === this.descriptor.parser.uuid &&
            origin.components.source.uuid === this.descriptor.source.uuid
        );
    }

    public description(): { major: string; minor: string } {
        return {
            major: this.descriptor.s_desc ? this.descriptor.s_desc : this.descriptor.source.name,
            minor: this.descriptor.p_desc ? this.descriptor.p_desc : this.descriptor.parser.name,
        };
    }

    public entry(): {
        from(entry: Entry): Error | undefined;
        to(): Entry;
    } {
        return {
            from: (_entry: Entry): Error | undefined => {
                return new Error(
                    `Instance method cannot be used on Action. Please use static methed instead.`,
                );
            },
            to: (): Entry => {
                return {
                    uuid: this.hash,
                    content: JSON.stringify({
                        stat: this.stat.asObj(),
                        descriptor: this.descriptor,
                        hash: this.hash,
                        setup: this.setup,
                    } as IActionContent),
                };
            },
        };
    }

    public getActions(): { caption?: string; handler?: () => void }[] {
        const configurable = this.setup.parser.fields.length + this.setup.source.fields.length > 0;
        return [
            ...(configurable
                ? [
                      {
                          caption: 'Open with new configuration',
                          handler: () => {
                              session
                                  .initialize()
                                  .configure(
                                      SessionOrigin.fromSessionSetup(this.setup, this.descriptor),
                                  )
                                  .catch((err: Error) => {
                                      this.logger.error(
                                          `Fail to configure session setup: ${err.message}`,
                                      );
                                  });
                          },
                      },
                  ]
                : []),
        ];
    }

    public remove(): Promise<void> {
        return recent.delete([this.hash]).catch((err: Error) => {
            this.logger.error(`Fail to remove recent action: ${err.message}`);
        });
    }

    public apply(): Promise<void> {
        return session
            .initialize()
            .observe(SessionOrigin.fromSessionSetup(this.setup, this.descriptor))
            .then(() => {
                return undefined;
            })
            .catch((err: Error) => {
                const message = lockers.lock(
                    new Locker(false, `Fail to apply action via error: ${err.message}`)
                        .set()
                        .buttons([
                            {
                                caption: `Remove`,
                                handler: () => {
                                    this.remove().finally(() => {
                                        message.popup.close();
                                    });
                                },
                            },
                            {
                                caption: `Cancel`,
                                handler: () => {
                                    message.popup.close();
                                },
                            },
                        ])
                        .end(),
                    {
                        closable: false,
                    },
                );
            });
    }

    public merge(action: Action): void {
        this.stat = action.stat;
        this.stat.update();
    }
}
