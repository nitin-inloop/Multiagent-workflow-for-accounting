import { TextractServiceException as __BaseException } from "./TextractServiceException";
export class AccessDeniedException extends __BaseException {
    name = "AccessDeniedException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "AccessDeniedException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, AccessDeniedException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class BadDocumentException extends __BaseException {
    name = "BadDocumentException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "BadDocumentException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, BadDocumentException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class DocumentTooLargeException extends __BaseException {
    name = "DocumentTooLargeException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "DocumentTooLargeException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, DocumentTooLargeException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class HumanLoopQuotaExceededException extends __BaseException {
    name = "HumanLoopQuotaExceededException";
    $fault = "client";
    ResourceType;
    QuotaCode;
    ServiceCode;
    Message;
    Code;
    constructor(opts) {
        super({
            name: "HumanLoopQuotaExceededException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, HumanLoopQuotaExceededException.prototype);
        this.ResourceType = opts.ResourceType;
        this.QuotaCode = opts.QuotaCode;
        this.ServiceCode = opts.ServiceCode;
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class InternalServerError extends __BaseException {
    name = "InternalServerError";
    $fault = "server";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "InternalServerError",
            $fault: "server",
            ...opts,
        });
        Object.setPrototypeOf(this, InternalServerError.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class InvalidParameterException extends __BaseException {
    name = "InvalidParameterException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "InvalidParameterException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidParameterException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class InvalidS3ObjectException extends __BaseException {
    name = "InvalidS3ObjectException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "InvalidS3ObjectException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidS3ObjectException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class ProvisionedThroughputExceededException extends __BaseException {
    name = "ProvisionedThroughputExceededException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "ProvisionedThroughputExceededException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ProvisionedThroughputExceededException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class ThrottlingException extends __BaseException {
    name = "ThrottlingException";
    $fault = "server";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "ThrottlingException",
            $fault: "server",
            ...opts,
        });
        Object.setPrototypeOf(this, ThrottlingException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class UnsupportedDocumentException extends __BaseException {
    name = "UnsupportedDocumentException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "UnsupportedDocumentException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, UnsupportedDocumentException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class ConflictException extends __BaseException {
    name = "ConflictException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "ConflictException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ConflictException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class IdempotentParameterMismatchException extends __BaseException {
    name = "IdempotentParameterMismatchException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "IdempotentParameterMismatchException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, IdempotentParameterMismatchException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class LimitExceededException extends __BaseException {
    name = "LimitExceededException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "LimitExceededException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, LimitExceededException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class ServiceQuotaExceededException extends __BaseException {
    name = "ServiceQuotaExceededException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "ServiceQuotaExceededException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ServiceQuotaExceededException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class ValidationException extends __BaseException {
    name = "ValidationException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "ValidationException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ValidationException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class InvalidKMSKeyException extends __BaseException {
    name = "InvalidKMSKeyException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "InvalidKMSKeyException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidKMSKeyException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class ResourceNotFoundException extends __BaseException {
    name = "ResourceNotFoundException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "ResourceNotFoundException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, ResourceNotFoundException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
export class InvalidJobIdException extends __BaseException {
    name = "InvalidJobIdException";
    $fault = "client";
    Message;
    Code;
    constructor(opts) {
        super({
            name: "InvalidJobIdException",
            $fault: "client",
            ...opts,
        });
        Object.setPrototypeOf(this, InvalidJobIdException.prototype);
        this.Message = opts.Message;
        this.Code = opts.Code;
    }
}
