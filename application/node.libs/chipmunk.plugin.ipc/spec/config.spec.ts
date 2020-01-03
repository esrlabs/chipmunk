// tslint:disable

/// <reference path="../node_modules/@types/jasmine/index.d.ts" />
/// <reference path="../node_modules/@types/node/index.d.ts" />

//./node_modules/.bin/jasmine-ts src/something.spec.ts
import * as path from 'path';
import * as fs from 'fs';

import ServiceConfig from '../src/services/service.config';

const CTmpFolder = path.resolve(process.cwd(), './spec/tmp');

console.log(process.cwd());

jasmine.DEFAULT_TIMEOUT_INTERVAL = 6000*1000;

function removeFileIfExists(file: string) {
    if (!fs.existsSync(file)) {
        return;
    }
    fs.unlinkSync(file);
}

describe('ServiceConfig', () => {
    
    it('Create / Read', (done: Function)=>{
        ServiceConfig.setup(CTmpFolder, 'test1');
        removeFileIfExists(ServiceConfig.getFileName());
        ServiceConfig.setDefault({ one: 1, two: 'two', three: { a: 1, b: 2 } });
        ServiceConfig.read().then((settins: any) => {
            expect(settins.one).toBe(1);
            expect(settins.two).toBe('two');
            expect(settins.three.a).toBe(1);
            done();
        }).catch((err: Error) => {
            console.log(err);
            expect(true).toBe(false);
            done();
        });
    });

    it('Create / Read / Write', (done: Function)=>{
        ServiceConfig.setup(CTmpFolder, 'test2');
        removeFileIfExists(ServiceConfig.getFileName());
        ServiceConfig.setDefault({ one: 1, two: 'two', three: { a: 1, b: 2 } });
        ServiceConfig.read().then((settins: any) => {
            expect(settins.one).toBe(1);
            expect(settins.two).toBe('two');
            expect(settins.three.a).toBe(1);
            ServiceConfig.write().then(() => {
                expect(fs.existsSync(ServiceConfig.getFileName())).toBe(true);
                removeFileIfExists(ServiceConfig.getFileName());
                done();
            }).catch((err: Error) => {
                console.log(err);
                expect(true).toBe(false);
                done();
            });
        }).catch((err: Error) => {
            console.log(err);
            expect(true).toBe(false);
            done();
        });
    });

    it('Create / Read / Write / Read', (done: Function)=>{
        ServiceConfig.setup(CTmpFolder, 'test3');
        removeFileIfExists(ServiceConfig.getFileName());
        ServiceConfig.setDefault({ one: 1, two: 'two', three: { a: 1, b: 2 } });
        ServiceConfig.read().then((settins: any) => {
            expect(settins.one).toBe(1);
            expect(settins.two).toBe('two');
            expect(settins.three.a).toBe(1);
            ServiceConfig.write({ three: { c: 1, d: 2}}).then(() => {
                expect(fs.existsSync(ServiceConfig.getFileName())).toBe(true);
                ServiceConfig.read().then((settins: any) => {
                    expect(settins.three.a).toBe(undefined);
                    expect(settins.three.c).toBe(1);
                    removeFileIfExists(ServiceConfig.getFileName());
                    done();
                }).catch((err: Error) => {
                    console.log(err);
                    expect(true).toBe(false);
                    done();
                });
            }).catch((err: Error) => {
                console.log(err);
                expect(true).toBe(false);
                done();
            });
        }).catch((err: Error) => {
            console.log(err);
            expect(true).toBe(false);
            done();
        });
    });

    it('Create / Read / Write / Read / Drop', (done: Function)=>{
        ServiceConfig.setup(CTmpFolder, 'test4');
        removeFileIfExists(ServiceConfig.getFileName());
        ServiceConfig.setDefault({ one: 1, two: 'two', three: { a: 1, b: 2 } });
        ServiceConfig.read().then((settins: any) => {
            expect(settins.one).toBe(1);
            expect(settins.two).toBe('two');
            expect(settins.three.a).toBe(1);
            ServiceConfig.write({ three: { c: 1, d: 2}}).then(() => {
                expect(fs.existsSync(ServiceConfig.getFileName())).toBe(true);
                ServiceConfig.read().then((settins: any) => {
                    expect(settins.three.a).toBe(undefined);
                    expect(settins.three.c).toBe(1);
                    ServiceConfig.drop().then(() => {
                        expect(fs.existsSync(ServiceConfig.getFileName())).toBe(false);
                        ServiceConfig.read().then((settins: any) => {
                            expect(settins.one).toBe(1);
                            expect(settins.two).toBe('two');
                            expect(settins.three.a).toBe(1);
                            done();
                        }).catch((err: Error) => {
                            console.log(err);
                            expect(true).toBe(false);
                            done();
                        });
                    }).catch((err: Error) => {
                        console.log(err);
                        expect(true).toBe(false);
                        done();
                    });
                }).catch((err: Error) => {
                    console.log(err);
                    expect(true).toBe(false);
                    done();
                });
            }).catch((err: Error) => {
                console.log(err);
                expect(true).toBe(false);
                done();
            });
        }).catch((err: Error) => {
            console.log(err);
            expect(true).toBe(false);
            done();
        });
    });

    it('Create / Drop / Read', (done: Function)=>{
        ServiceConfig.setup(CTmpFolder, 'test5');
        removeFileIfExists(ServiceConfig.getFileName());
        ServiceConfig.setDefault({ one: 1, two: 'two', three: { a: 1, b: 2 } });
        ServiceConfig.read().then((settins: any) => {
            expect(settins.one).toBe(1);
            expect(settins.two).toBe('two');
            expect(settins.three.a).toBe(1);
            ServiceConfig.drop().then(() => {
                expect(fs.existsSync(ServiceConfig.getFileName())).toBe(false);
                ServiceConfig.read().then((settins: any) => {
                    expect(settins.one).toBe(1);
                    expect(settins.two).toBe('two');
                    expect(settins.three.a).toBe(1);
                    done();
                }).catch((err: Error) => {
                    console.log(err);
                    expect(true).toBe(false);
                    done();
                });
            }).catch((err: Error) => {
                console.log(err);
                expect(true).toBe(false);
                done();
            });
        }).catch((err: Error) => {
            console.log(err);
            expect(true).toBe(false);
            done();
        });
    });

    it('No defaults / Read', (done: Function)=>{
        ServiceConfig.setup(CTmpFolder, 'test6');
        (ServiceConfig as any)['_defaults'] = undefined;
        removeFileIfExists(ServiceConfig.getFileName());
        ServiceConfig.read().then((settins: any) => {
            // Shound not be here. Read should be rejected
            expect(true).toBe(false);
            done();
        }).catch((err: Error) => {
            console.log(`Success: ${err.message}`);
            done();
        });
    });

    it('No defaults / Write', (done: Function)=>{
        ServiceConfig.setup(CTmpFolder, 'test6');
        (ServiceConfig as any)['_defaults'] = undefined;
        removeFileIfExists(ServiceConfig.getFileName());
        ServiceConfig.write().then((settins: any) => {
            // Shound not be here. Read should be rejected
            expect(true).toBe(false);
            done();
        }).catch((err: Error) => {
            console.log(`Success: ${err.message}`);
            done();
        });
    });
    
});
