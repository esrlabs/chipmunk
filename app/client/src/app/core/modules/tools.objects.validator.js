"use strict";
var Validator = (function () {
    function Validator() {
    }
    Validator.prototype.getNameProtorype = function (target) {
        var results = /function (.{1,})\(/.exec(target.constructor.toString());
        return (results && results.length > 1) ? results[1] : "";
    };
    Validator.prototype.check = function (target, scheme) {
        var _this = this;
        var result = true;
        Object.keys(scheme).forEach(function (name) {
            if (result) {
                target[name] === void 0 && (result = new Error('Property [' + name + '] is not defined.'));
                if (!(result instanceof Error)) {
                    if (typeof scheme[name] === 'string') {
                        typeof target[name] !== scheme[name] && (result = new Error('Property [' + name + '] has wrong type. Expected: ' + scheme[name]));
                    }
                    else {
                        Object.getPrototypeOf(target[name]) !== scheme[name] && (result = new Error('Property [' + name + '] has wrong prototype. Expected: [' + _this.getNameProtorype(scheme[name]) + ']'));
                    }
                }
            }
        });
        return result;
    };
    Validator.prototype.validate = function (target, scheme) {
        if (typeof target === 'object' && target !== null) {
            if (typeof scheme === 'undefined') {
                return true;
            }
            else if (typeof scheme === 'object' && scheme !== null) {
                return this.check(target, scheme);
            }
            else {
                return new Error('Scheme is not an object.');
            }
        }
        else {
            return new Error('Target is not an object.');
        }
    };
    return Validator;
}());
var validator = new Validator();
exports.validator = validator;
//# sourceMappingURL=tools.objects.validator.js.map