import { EntryConvertable, Entry } from '@platform/types/storage/entry';
import { Subject } from '@platform/env/subscription';
import { error, Instance as Logger } from '@platform/env/logger';
import { scope } from '@platform/env/scope';
import { Definition } from './definition';
import { bridge } from '@service/bridge';
import { Session } from '../session/session';

export class Definitions {
    static UUID = 'history_definitions_holder';
    protected definitions: Map<string, Definition> = new Map();
    protected readonly logger: Logger;

    constructor() {
        this.logger = scope.getLogger(`Definitions holder (history)`);
    }

    public addFrom(session: Session): Definition[] {
        return this.add(
            session.stream
                .observe()
                .sources()
                .map((s) => Definition.fromDataSource(s)),
        );
    }

    public add(definitions: Definition[] | Definition): Definition[] {
        if (!(definitions instanceof Array)) {
            definitions = [definitions];
        }
        const size = this.definitions.size;
        const toBeReturn: Definition[] = [];
        const toBeInsert: Definition[] = [];
        definitions
            .filter((def) => {
                let exist = false;
                this.definitions.forEach((d) => {
                    if (exist) {
                        return;
                    }
                    exist = d.isSame(def);
                    if (exist) {
                        toBeReturn.push(d);
                    }
                });
                return !exist;
            })
            .forEach((def) => {
                this.definitions.set(def.uuid, def);
                toBeInsert.push(def);
                toBeReturn.push(def);
            });
        return toBeReturn;
        // await bridge
        //     .entries(Definitions.UUID)
        //     .append(toBeInsert.map((i) => i.entry().to()))
        //     .catch((err: Error) => {
        //         this.logger.warn(`Fail to write history definitions: ${err.message}`);
        //     });
    }
}
