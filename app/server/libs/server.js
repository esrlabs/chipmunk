const logger            = new (require('./tools.logger'))('Server');

const SETTINGS          = require('../config.js'),
      Errors            = require('./errors'),
      APIProcessor      = require('./api.processor.js'),
      WSServer          = require('./websocket.server.js'),
      ServerEmitter     = require('./server.events.js');

const Response          = require('./api.response').Response,
      ResponseSender    = require('./api.response').ResponseSender;

const MonitorService    = require('./service.monitor');

const METHODS = {
    POST    : 'POST',
    GET     : 'GET'
};

const REQUEST_EVENTS = {
    data    : 'data',
    end     : 'end'
};

const TARGET_POST_URLS = {
    API : '/api'
};

class Server {

    constructor(){
        this.server         = null;
        this.wsServer       = null;
        this.errors         = new Errors.Errors();
        this.WSEventEmitter = null;
        logger.info('Session started');
    }

    probPort(port, callback){
        let net = require('net');
        let server = net.createServer().listen(port);
        server.on('listening', () => {
            server.close();
            callback(true);
        });
        server.on('error', () => {
            callback(false);
        });
    }

    create(){
        //Create HTTP Server
        let http = require('http');
        this.probPort(SETTINGS.HTTP_PORT, (available) => {
            if (available) {
                logger.info('Creating server on  http://127.0.0.1:' + SETTINGS.HTTP_PORT + '/');
                this.server     = http.createServer(this.onRequest.bind(this));
                logger.info('Server is created. Start listening http://127.0.0.1:' + SETTINGS.HTTP_PORT + '/')
                this.server.listen(SETTINGS.HTTP_PORT);
                //Create WS Server
                this.wsServer       = new WSServer(this.server);
                this.WSEventEmitter = this.wsServer.create();
            } else {
                logger.warning('Default port is used: ' + SETTINGS.HTTP_PORT + '. Will try: ' + (++SETTINGS.HTTP_PORT))
                this.create();
            }
        });
    }

    allowAnyOrigin(response){
        response.setHeader('Access-Control-Allow-Origin',   '*');
        response.setHeader('Access-Control-Request-Method', '*');
        response.setHeader('Access-Control-Allow-Methods',  'GET, POST');
        response.setHeader('Access-Control-Allow-Headers',  '*');
    }

    onRequest(request, response){
        this.allowAnyOrigin(response);
        switch (request.method){
            case METHODS.GET:
                logger.info('Get GET request. Url: ' + request.url);
                return this.onGET(request, response);
            case METHODS.POST:
                logger.info('Get POST request. Url: ' + request.url);
                return this.onPOST(request, response);
        }
    }

    onGET(request, response){

    }

    onPOST(request, response){
        switch (request.url.toLowerCase()){
            case TARGET_POST_URLS.API:
                this.getPOSTData(request, (post, error)=>{
                    if (!this.errors.process(error, response)){
                        let processor = new APIProcessor(post, response);
                        processor.proceed((result, errors, noResponse = false)=>{
                            if (errors instanceof Array || errors !== null){
                                (errors instanceof Array ? errors : [errors]).forEach((error)=>{
                                    logger.error(error.message);
                                });
                                this.errors.process(Errors.ERRORS.PARSING_COMMAND_ERROR, response, errors);
                            } else {
                                if (noResponse) {
                                    return false;
                                }
                                let res     = new Response();
                                res.output  = result;
                                ResponseSender(res, response);
                            }
                        });
                    } else {
                        //Destroy connection
                        request.connection.destroy();
                    }
                });
                break;
            default:
                //Call error
                this.errors.process(Errors.ERRORS.NO_TARGET_URL_FOUND, response);
                //Destroy connection
                request.connection.destroy();
                break;
        }
    }

    getPOSTData(request, callback){
        let querystring = require('querystring'),
            str         = '';

        request.on(REQUEST_EVENTS.data, (data)=>{
            str += data;
            str.length > SETTINGS.MAX_POST_LENGTH && callback(null, Errors.ERRORS.TOO_LARGE_REQ);
        });

        request.on(REQUEST_EVENTS.end, ()=>{
            let post = querystring.parse(str);
            callback(post, null);
        });
    }
}

module.exports = Server;