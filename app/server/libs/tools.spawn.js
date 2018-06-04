const SPAWN_EVENTS = {
    exit        : 'exit',
    error       : 'error',
    close       : 'close',
    disconnect  : 'disconnect',
    data        : 'data',
    done        : 'done'
};

const WRAPPER_EVENTS = {
    exit        : Symbol('exit'),
    error       : Symbol('error'),
    close       : Symbol('close'),
    disconnect  : Symbol('disconnect'),
    data        : Symbol('data'),
    done        : Symbol('done')
};


const logger        = new (require('./tools.logger'))('SpawnWrapper');
const StringDecoder = require('string_decoder').StringDecoder;
const util          = require('util');
const spawn         = require('child_process').spawn;
const EventEmitter  = require('events').EventEmitter;

class SpawnWrapper extends EventEmitter{

    constructor(output = false){
        super();
        this._spawn         = null;
        this._destroy       = this._destroy.bind(this);
        this._onError       = this._onError.bind(this);
        this._onClose       = this._onClose.bind(this);
        this._onDisconnect  = this._onDisconnect.bind(this);
        this._onExit        = this._onExit.bind(this);
        this._onData        = this._onData.bind(this);
        this._timeout       = -1;
        this._timer         = -1;
        this._output        = output ? '' : null;
        this._decoder       = new StringDecoder('utf8');
        this.EVENTS         = WRAPPER_EVENTS;
    }

    execute(command, params, env = null, timeout = -1){
        env === null && (env = process.env);
        return new Promise((resolve, reject) => {
            if (this._spawn !== null) {
                return reject(new Error(`Spawn already executed and wasn't finished yet.`));
            }
            try {
                this._spawn = spawn(command, params, {
                    env: env !== null ? env : process.env
                });
                this._bind();
                if (this._spawn !== null && (typeof this._spawn.pid !== 'number' || this._spawn.pid <= 0)){
                    return reject(new Error(logger.error(`Fail to execute command: ${util.inspect(command)}, params: ${util.inspect(params)}, env: ${util.inspect(env)}`)));
                }
                this._setTimeout(timeout);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    _setTimeout(timeout){
        if (timeout > 0) {
            this._timeout = timeout;
            this._timer = setTimeout(this._timeouted.bind(this), timeout);
        }
    }

    _clearTimeout(){
        this._timer !== -1 && clearTimeout(this._timer);
        this._timer = -1;
    }

    _timeouted(){
        this._destroy();
    }

    _onError(error, ...args){
        this.emit(this.EVENTS.error, error, ...args);
    }

    _onClose(...args){
        this.emit(this.EVENTS.close, ...args);
        this._destroy();
    }

    _onDisconnect(...args){
        this.emit(this.EVENTS.disconnect, ...args);
        this._destroy();
    }

    _onExit(...args){
        this.emit(this.EVENTS.exit, ...args);
        this._destroy();
    }

    _onData(...args){
        if (this._output !== null){
            const out = this._decode(...args);
            out !== null && (this._output += out);
        }
        this.emit(this.EVENTS.data, ...args);
    }

    _decode(message){
        try {
            return this._decoder.write(message);
        } catch (error){
            return null;
        }
    }

    _bind(){
        if (this._spawn !== null){
            this._spawn.on(SPAWN_EVENTS.error,        this._onError);
            this._spawn.on(SPAWN_EVENTS.close,        this._onClose);
            this._spawn.on(SPAWN_EVENTS.disconnect,   this._onDisconnect);
            this._spawn.on(SPAWN_EVENTS.exit,         this._onExit);
            this._spawn.stdout.on(SPAWN_EVENTS.data,  this._onData);
            process.on(SPAWN_EVENTS.exit,             this._destroy);
        }
    }

    _unbind(){
        if (this._spawn !== null){
            this._spawn.removeAllListeners(         SPAWN_EVENTS.error);
            this._spawn.removeAllListeners(         SPAWN_EVENTS.close);
            this._spawn.removeAllListeners(         SPAWN_EVENTS.disconnect);
            this._spawn.removeAllListeners(         SPAWN_EVENTS.exit);
            this._spawn.stdout.removeAllListeners(  SPAWN_EVENTS.data);
            process.removeListener(                 SPAWN_EVENTS.exit, this._destroy);
        }
    }

    _destroy() {
        this._clearTimeout();
        this._unbind();
        this._spawn !== null && this._spawn.kill();
        this._spawn  = null;
        this.emit(this.EVENTS.done, this._output);
    }

    kill(){
        this._destroy();
    }
}

module.exports = SpawnWrapper;