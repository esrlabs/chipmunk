import { EntryConvertable, Entry } from '@platform/types/storage/entry';
import { Subject } from '@platform/env/subscription';
import { error, Instance as Logger } from '@platform/env/logger';
import { scope } from '@platform/env/scope';
import { Definition } from './definition';
import { bridge } from '@service/bridge';
import { Session } from '../session/session';
import { DataSource, ParserName } from '@platform/types/observe';

export class Definitions {
    static UUID = 'history_definitions_holder';
    protected definitions: Map<string, Definition> = new Map();
    protected readonly logger: Logger;

    constructor() {
        this.logger = scope.getLogger(`Definitions holder (history)`);
    }

    public async add(source: DataSource): Promise<Definition> {
        const definition = await Definition.fromDataSource(source);
        this.definitions.set(definition.uuid, definition);
        return definition;
    }

    // public async addFrom(session: Session): Promise<Definition[]> {
    //     const defs: Definition[] = [];
    //     await Promise.all(
    //         session.stream
    //             .observe()
    //             .sources()
    //             .map((s) =>
    //                 Definition.fromDataSource(s)
    //                     .then((def) => defs.push(def))
    //                     .catch((err: Error) =>
    //                         this.logger.warn(`Fail to get definition of source: ${err.message}`),
    //                     ),
    //             ),
    //     );
    //     return this.add(defs);
    // }

    // public add(definitions: Definition[] | Definition): Definition[] {
    //     if (!(definitions instanceof Array)) {
    //         definitions = [definitions];
    //     }
    //     const size = this.definitions.size;
    //     const toBeReturn: Definition[] = [];
    //     const toBeInsert: Definition[] = [];
    //     definitions
    //         .filter((def) => {
    //             let exist = false;
    //             this.definitions.forEach((d) => {
    //                 if (exist) {
    //                     return;
    //                 }
    //                 exist = d.isSame(def);
    //                 if (exist) {
    //                     toBeReturn.push(d);
    //                 }
    //             });
    //             return !exist;
    //         })
    //         .forEach((def) => {
    //             this.definitions.set(def.uuid, def);
    //             toBeInsert.push(def);
    //             toBeReturn.push(def);
    //         });
    //     return toBeReturn;
    //     // await bridge
    //     //     .entries(Definitions.UUID)
    //     //     .append(toBeInsert.map((i) => i.entry().to()))
    //     //     .catch((err: Error) => {
    //     //         this.logger.warn(`Fail to write history definitions: ${err.message}`);
    //     //     });
    // }
}
