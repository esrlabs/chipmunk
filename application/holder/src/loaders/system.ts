/**
 * @module system
 * @description Module cares abopu loading of application
 */
import './services';
import './controllers';
import { system } from 'platform/modules/system';

system.init().then(() => {
    // system.destroy().then(() => {
    //     console.log(`goood`);
    // });
});
