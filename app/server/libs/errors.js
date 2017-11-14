const Response          = require('./api.response').Response,
      ResponseSender    = require('./api.response').ResponseSender;

const ERRORS = {
    TOO_LARGE_REQ           : 10001,
    NO_TARGET_URL_FOUND     : 10002,
    PARSING_COMMAND_ERROR   : 10003
};

class Errors{
    process(error, response, content){
        switch (error){
            case ERRORS.TOO_LARGE_REQ:
                response.writeHead(413, {'Content-Type': 'text/plain'});
                response.end('413');
                return true;
            case ERRORS.NO_TARGET_URL_FOUND:
                response.writeHead(404, {'Content-Type': 'text/plain'});
                response.end('404');
                return true;
            case ERRORS.PARSING_COMMAND_ERROR:
                let res     = new Response();
                res.code    = error;
                res.output  = content;
                ResponseSender(res, response);
                return true;
            default:
                return false;
        }
    }
}

module.exports = {
    ERRORS : ERRORS,
    Errors : Errors
};
