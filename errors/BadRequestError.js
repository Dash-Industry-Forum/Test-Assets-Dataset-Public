"use strict";
function BadRequestError(code, error) {
    Error.call(this, typeof error === "undefined" ? undefined : error.message);
    Error.captureStackTrace(this, this.constructor);
    this.name = "BadRequestError";
    this.message = typeof error === "undefined" ? undefined : error.message;
    this.code = code;
    this.status = 400;
    this.inner = error;
}

BadRequestError.prototype = Object.create(Error.prototype);
BadRequestError.prototype.constructor = BadRequestError;

module.exports = BadRequestError;
