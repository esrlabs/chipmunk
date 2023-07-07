import { Entry } from '@platform/types/storage/entry';
import { error } from '@platform/log/utils';
import { session } from '@service/session';
import { lockers, Locker } from '@ui/service/lockers';
import { Stat, IStat } from './stat';
import { recent } from '@service/recent';
import { scope } from '@platform/env/scope';
import { Logger } from '@platform/log';

import * as $ from '@platform/types/observe';
import * as compatibility from './compatibility';

interface IActionContent {
    stat: IStat;
    observe: $.IObserve;
}

export class Action {
    static from(entry: Entry): Action | Error {
        const action = new Action($.Observe.new());
        const error = action.entry().from(entry);
        return error instanceof Error ? error : action;
    }

    protected logger: Logger;

    public stat: Stat = Stat.defaults();
    public uuid: string;
    public compatibility: {
        converted: boolean;
        invalidUuid: string | undefined;
    } = {
        converted: false,
        invalidUuid: undefined,
    };

    constructor(public observe: $.Observe) {
        this.uuid = observe.signature();
        this.logger = scope.getLogger(`Action: ${this.uuid}`);
    }

    public isSuitable(observe?: $.Observe): boolean {
        if (observe === undefined) {
            return true;
        }
        if (observe.origin.nature().alias() !== this.observe.origin.nature().alias()) {
            return false;
        }
        return this.observe.parser.alias() === observe.parser.alias();
    }

    public description(): $.Description.IOriginDetails {
        return this.observe.origin.desc();
    }

    public entry(): {
        from(entry: Entry): Error | undefined;
        to(): Entry;
    } {
        return {
            from: (entry: Entry): Error | undefined => {
                try {
                    const body: IActionContent = JSON.parse(entry.content);
                    if (body.observe === undefined) {
                        // Check previous version (chipmunk <= 3.8.1)
                        this.observe = compatibility.from_3_8_1(entry);
                        this.compatibility.converted = true;
                    } else {
                        const observe = new $.Observe(body.observe);
                        this.observe = observe;
                    }
                    this.stat = Stat.from(body.stat);
                    this.uuid = this.observe.signature();
                    this.compatibility.invalidUuid =
                        entry.uuid !== this.uuid ? entry.uuid : undefined;
                    return undefined;
                } catch (err) {
                    return new Error(`Fail to parse action: ${error(err)}`);
                }
            },
            to: (): Entry => {
                return {
                    uuid: this.uuid,
                    content: JSON.stringify({
                        stat: this.stat.asObj(),
                        observe: this.observe.storable(),
                    } as IActionContent),
                };
            },
        };
    }

    public getActions(): { caption?: string; handler?: () => void }[] {
        const observe = this.observe;
        const configurable = observe.isConfigurable();
        const nature = observe.origin.nature().desc();
        return [
            {
                caption: ((): string => {
                    switch (nature.type) {
                        case $.Description.OriginType.file:
                            return 'Open';
                        case $.Description.OriginType.net:
                        case $.Description.OriginType.serial:
                            return 'Connect';
                        case $.Description.OriginType.command:
                            return 'Execute';
                    }
                })(),
                handler: this.apply.bind(this),
            },
            ...(configurable
                ? [
                      {
                          caption: 'Configure',
                          handler: () => {
                              session
                                  .initialize()
                                  .configure(observe)
                                  .catch((err: Error) => {
                                      this.logger.error(
                                          `Fail to configure observe object: ${err.message}`,
                                      );
                                  });
                          },
                      },
                  ]
                : []),
        ];
    }

    public remove(): Promise<void> {
        return recent.delete([this.uuid]).catch((err: Error) => {
            this.logger.error(`Fail to remove recent action: ${err.message}`);
        });
    }

    public apply(): Promise<void> {
        return session
            .initialize()
            .auto(this.observe.locker().lock())
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
