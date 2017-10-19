"use strict";
function InternalError(code, error) {
    Error.call(this, typeof error === "undefined" ? undefined : error.message);
    Error.captureStackTrace(this, this.constructor);
    this.name = "InternalError";
    this.message = typeof error === "undefined" ? undefined : error.message;
    this.code = code;
    this.status = 500;
    this.inner = error;
}

InternalError.prototype = Object.create(Error.prototype);
InternalError.prototype.constructor = InternalError;

module.exports = InternalError;
