// tslint:disable

// We need to provide path to TypeScript types definitions
/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />
import { initLogger } from './logger';
initLogger();
import { Session, Factory } from '../src/api/session';
import { IGrabbedElement } from '../src/interfaces/index';
import { createSampleFile, finish, runner } from './common';
import { readConfigurationFile } from './config';

const config = readConfigurationFile().get().tests.ranges;

function sum(from: number, to: number): number {
    let s = 0;
    for (let i = from; i <= to; i += 1) {
        s += i;
    }
    return s;
}

describe('Grab ranges', function () {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
            Session.create()
                .then((session: Session) => {
                    // Set provider into debug mode
                    session.debug(true);
                    const stream = session.getStream();
                    if (stream instanceof Error) {
                        finish(session, done, stream);
                        return;
                    }
                    const events = session.getEvents();
                    if (events instanceof Error) {
                        finish(session, done, events);
                        return;
                    }
                    const tmpobj = createSampleFile(1000, logger, (i: number) => `${i}\n`);
                    stream
                        .observe(
                            new Factory.File()
                                .asText()
                                .type(Factory.FileType.Text)
                                .file(tmpobj.name).observe.configuration,
                        )
                        .catch(finish.bind(null, session, done));
                    let grabbing: boolean = false;
                    events.StreamUpdated.subscribe((rows: number) => {
                        if (rows === 0 || grabbing) {
                            return;
                        }
                        grabbing = true;
                        Promise.all([
                            stream
                                .grabRanges([{ from: 0, to: 99 }])
                                .then((result: IGrabbedElement[]) => {
                                    logger.debug('result of grab was: ' + JSON.stringify(result));
                                    expect(
                                        result
                                            .map((v) => parseInt(v.content, 10))
                                            .reduce((partialSum, a) => partialSum + a, 0),
                                    ).toEqual(sum(0, 99));
                                }),
                            stream
                                .grabRanges([
                                    { from: 0, to: 0 },
                                    { from: 10, to: 10 },
                                ])
                                .then((result: IGrabbedElement[]) => {
                                    logger.debug('result of grab was: ' + JSON.stringify(result));
                                    expect(result.length).toEqual(2);
                                    expect(parseInt(result[0].content, 10)).toEqual(0);
                                    expect(parseInt(result[1].content, 10)).toEqual(10);
                                }),
                            stream
                                .grabRanges([
                                    { from: 0, to: 10 },
                                    { from: 99, to: 200 },
                                    { from: 299, to: 300 },
                                    { from: 599, to: 600 },
                                ])
                                .then((result: IGrabbedElement[]) => {
                                    logger.debug('result of grab was: ' + JSON.stringify(result));
                                    expect(
                                        result
                                            .map((v) => parseInt(v.content, 10))
                                            .reduce((partialSum, a) => partialSum + a, 0),
                                    ).toEqual(
                                        sum(0, 10) + sum(99, 200) + sum(299, 300) + sum(599, 600),
                                    );
                                }),
                        ])
                            .then(() => {
                                finish(session, done);
                            })
                            .catch((err: Error) => {
                                finish(
                                    session,
                                    done,
                                    new Error(
                                        `Fail to grab data due error: ${
                                            err instanceof Error ? err.message : err
                                        }`,
                                    ),
                                );
                            });
                    });
                })
                .catch((err: Error) => {
                    finish(
                        undefined,
                        done,
                        new Error(
                            `Fail to create session due error: ${
                                err instanceof Error ? err.message : err
                            }`,
                        ),
                    );
                });
        });
    });
});
