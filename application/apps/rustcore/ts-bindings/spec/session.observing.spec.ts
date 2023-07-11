import { initLogger } from './logger';
initLogger();
import { finish, runner } from './common';
import { readConfigurationFile } from './config';
import { Observer } from 'platform/env/observer';

const config = readConfigurationFile().get().tests.observing;

describe('Platform: observing', function () {
    it(config.regular.list[1], function () {
        return runner(config.regular, 1, async (logger, done, collector) => {
            const entity = new Observer({
                a: 1,
                b: 2,
                c: [1, 2, 3],
                d: [
                    { a: 1, b: 2, c: [1, 2, 3] },
                    { a: 1, b: 2, c: [1, 2, 3] },
                ],
            });
            let changes: number = 0;
            entity.watcher.subscribe((event) => {
                changes += 1;
            });
            entity.target.a += 1;
            expect(entity.target.a).toEqual(2);
            entity.target.b += 1;
            expect(entity.target.b).toEqual(3);
            entity.target.c.push(4);
            expect(entity.target.c.length).toEqual(4);
            entity.target.c.splice(1, 1);
            expect(entity.target.c.length).toEqual(3);
            entity.target.d[0].a += 1;
            expect(entity.target.d[0].a).toEqual(2);
            entity.target.d[0].b += 1;
            expect(entity.target.d[0].b).toEqual(3);
            entity.target.d[0].c.push(4);
            expect(entity.target.d[0].c.length).toEqual(4);
            entity.target.d.push({ a: 1, b: 2, c: [1, 2, 3] });
            expect(entity.target.d.length).toEqual(3);
            entity.target.d[entity.target.d.length - 1].a += 1;
            expect(entity.target.d[entity.target.d.length - 1].a).toEqual(2);
            entity.target.d[entity.target.d.length - 1].b += 1;
            expect(entity.target.d[entity.target.d.length - 1].b).toEqual(3);
            entity.target.d[entity.target.d.length - 1].c.push(4);
            expect(entity.target.d[entity.target.d.length - 1].c.length).toEqual(4);
            entity.target.d.splice(1, 1);
            expect(entity.target.d.length).toEqual(2);
            (entity.target as any)['newProp'] = 'test';
            expect((entity.target as any)['newProp']).toEqual('test');
            (entity.target as any)['newObj'] = { a: 1, b: 2 };
            (entity.target as any)['newObj'].a += 1;
            (entity.target as any)['newObj'].b += 1;
            expect((entity.target as any)['newObj'].a).toEqual(2);
            expect((entity.target as any)['newObj'].b).toEqual(3);
            // Note: splice of array gives multiple changes:
            // - change of position of each element
            // - change of array's length
            expect(changes).toEqual(20);
            finish(undefined, done);
        });
    });
});
