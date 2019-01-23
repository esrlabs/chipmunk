const logger = new (require('./libs/tools.logger'))('Service');
logger.debug('Server module is attached');
const SETTINGS = require('./config.js');
let Server = require('./libs/server.js');
logger.debug('Creating server controller');
let server = new Server();
logger.debug('Creating server');
server.create();