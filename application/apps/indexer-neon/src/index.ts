const addon = require('../native');

export interface ILibrary {
    hello: () => string;
}

const library: ILibrary = {
    hello: addon.hello,
}

export default library;