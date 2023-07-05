import { Entry } from '@platform/types/storage/entry';
import { error } from '@platform/log/utils';
import { unique } from '@platform/env/sequence';
import { session } from '@service/session';
import { lockers, Locker } from '@ui/service/lockers';
import { Stat, IStat } from './stat';
import { recent } from '@service/recent';
import { scope } from '@platform/env/scope';
import { Logger } from '@platform/log';

import * as $ from '@platform/types/observe';
import * as Factory from '@platform/types/observe/factory';

interface IActionContent {
    stat: IStat;
    observe: $.IObserve;
}

// This function has to be removed since v 3.9.x or 3.10.x (after a couple of
// update iterations)
function convertVersion_3_8_1_FormatToCurrent(entry: Entry): $.Observe {
    const action = JSON.parse(entry.content);
    let observe;
    if (action['file'] !== undefined) {
        if (action['file']['dlt'] !== undefined) {
            observe = new Factory.File()
                .asDlt(action['file']['dlt'])
                .type($.Types.File.FileType.Binary)
                .file(action['file']['filename'])
                .get();
        } else if (action['file']['pcap'] !== undefined) {
            observe = new Factory.File()
                .asDlt(action['file']['pcap']['dlt'])
                .type($.Types.File.FileType.PcapNG)
                .file(action['file']['filename'])
                .get();
        } else {
            observe = new Factory.File()
                .asText()
                .file(action['file']['filename'])
                .type($.Types.File.FileType.Text)
                .get();
        }
    } else if (action['dlt_stream'] !== undefined) {
        const defs = action['dlt_stream'];
        const source = defs['source'];
        const preconstructed = new Factory.Stream().asDlt(defs['dlt']);
        if (source['process'] !== undefined) {
            preconstructed.process(source['process']);
        } else if (source['serial'] !== undefined) {
            preconstructed.serial(source['serial']);
        } else if (source['tcp'] !== undefined) {
            preconstructed.tcp(source['tcp']);
        } else if (source['udp'] !== undefined) {
            preconstructed.udp(source['udp']);
        } else {
            throw new Error(`Unknonw type of source for stream.`);
        }
        observe = preconstructed.get();
    } else if (action['text_stream'] !== undefined) {
        const defs = action['text_stream'];
        const source = defs['source'];
        const preconstructed = new Factory.Stream().asText();
        if (source['process'] !== undefined) {
            preconstructed.process(source['process']);
        } else if (source['serial'] !== undefined) {
            preconstructed.serial(source['serial']);
        } else if (source['tcp'] !== undefined) {
            preconstructed.tcp(source['tcp']);
        } else if (source['udp'] !== undefined) {
            preconstructed.udp(source['udp']);
        } else {
            throw new Error(`Unknonw type of source for stream.`);
        }
        observe = preconstructed.get();
    } else {
        throw new Error(`Unknonw type of action.`);
    }
    const error = observe.validate();
    if (error instanceof Error) {
        throw error;
    }
    return observe;
}

export class Action {
    static from(entry: Entry): Action | Error {
        const action = new Action($.Observe.new());
        const error = action.entry().from(entry);
        return error instanceof Error ? error : action;
    }

    protected logger: Logger;

    public stat: Stat = Stat.defaults();
    public uuid: string = unique();

    constructor(public observe: $.Observe) {
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
                        // console.log(JSON.parse(entry.content));
                        this.observe = convertVersion_3_8_1_FormatToCurrent(entry);
                    } else {
                        const observe = new $.Observe(body.observe);
                        const err = observe.json().from(entry.content);
                        if (err instanceof Error) {
                            return err;
                        }
                        this.observe = observe;
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
