import { Entry } from '@platform/types/storage/entry';
import { error } from '@platform/log/utils';
import { unique } from '@platform/env/sequence';
import { session } from '@service/session';
// import { lockers, Locker } from '@ui/service/lockers';
import { Stat, IStat } from './stat';
// import { recent } from '@service/recent';

import * as $ from '@platform/types/observe';

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

    public stat: Stat = Stat.defaults();
    public uuid: string = unique();

    constructor(public readonly observe: $.Observe) {}

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
                    const observe = new $.Observe(body.observe);
                    const err = observe.json().from(entry.content);
                    if (err instanceof Error) {
                        return err;
                    }
                    this.stat = Stat.from(body.stat);
                    this.uuid = entry.uuid;
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
                        observe: this.observe.configuration,
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
                                      console.error(
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
        // TODO: removing of action should be defined here
        return Promise.resolve();
    }

    public apply(): Promise<void> {
        throw new Error(`TODO: Implement!`);
        // (() => {
        //     if (this.file !== undefined) {
        //         if (this.file.text !== undefined) {
        //             return opener.text(this.file.text.filename).text();
        //         } else if (this.file.dlt !== undefined) {
        //             return opener.binary(this.file.dlt.filename).dlt(this.file.dlt.options);
        //         } else {
        //             return Promise.reject(new Error(`Opener for file action isn't found`));
        //         }
        //     } else if (this.dlt_stream !== undefined) {
        //         return opener
        //             .stream(this.dlt_stream.source, undefined, undefined)
        //             .dlt(this.dlt_stream.options);
        //     } else if (this.someip_stream !== undefined) {
        //         return opener
        //             .stream(this.someip_stream.source, undefined, undefined)
        //             .someip(this.someip_stream.options);
        //     } else if (this.text_stream !== undefined) {
        //         return opener.stream(this.text_stream.source, undefined, undefined).text({});
        //     } else {
        //         return Promise.reject(new Error(`Opener for action isn't found`));
        //     }
        // })()
        //     .then(() => {
        //         this.handlers.after !== undefined && this.handlers.after();
        //         recent.update([this]).catch((err: Error) => {
        //             console.error(`Fail to update recent action: ${err.message}`);
        //         });
        //     })
        //     .catch((err: Error) => {
        //         const message = lockers.lock(
        //             new Locker(false, `Fail to apply action via error: ${err.message}`)
        //                 .set()
        //                 .buttons([
        //                     {
        //                         caption: `Remove`,
        //                         handler: () => {
        //                             remove([this.uuid]);
        //                             message.popup.close();
        //                         },
        //                     },
        //                     {
        //                         caption: `Cancel`,
        //                         handler: () => {
        //                             message.popup.close();
        //                         },
        //                     },
        //                 ])
        //                 .end(),
        //             {
        //                 closable: false,
        //             },
        //         );
        //     });
    }

    public merge(action: Action): void {
        this.stat = action.stat;
        this.stat.update();
    }
}
