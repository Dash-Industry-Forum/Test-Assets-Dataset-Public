"use strict";
function NotImplementedError(code, error) {
    Error.call(this, typeof error === "undefined" ? undefined : error.message);
    Error.captureStackTrace(this, this.constructor);
    this.name = "NotImplementedError";
    this.message = typeof error === "undefined" ? undefined : error.message;
    this.code = code;
    this.status = 400;
    this.inner = error;
}

NotImplementedError.prototype = Object.create(Error.prototype);
NotImplementedError.prototype.constructor = NotImplementedError;

module.exports = BadRequestError;
