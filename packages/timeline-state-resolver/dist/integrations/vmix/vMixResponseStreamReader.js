"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VMixResponseStreamReader = void 0;
const eventemitter3_1 = require("eventemitter3");
const RESPONSE_REGEX = /^(?<command>\w+)\s+(?<response>OK|ER|\d+)(\s+(?<responseMsg>.*))?/i;
/**
 * A receiver for vMix responses
 */
class VMixResponseStreamReader extends eventemitter3_1.EventEmitter {
    constructor() {
        super(...arguments);
        this._unprocessedLines = [];
        this._lineRemainder = '';
    }
    reset() {
        this._unprocessedLines = [];
        this._lineRemainder = '';
    }
    processIncomingData(data) {
        const remainingData = this._lineRemainder + data;
        const incomingLines = remainingData.split('\r\n');
        const lastChunk = incomingLines.pop();
        if (lastChunk != null && lastChunk !== '') {
            // Incomplete line found at the end - keep it
            this._lineRemainder = lastChunk;
        }
        else {
            this._lineRemainder = '';
        }
        this._unprocessedLines.push(...incomingLines);
        let lineToProcess;
        while ((lineToProcess = this._unprocessedLines.shift()) != null) {
            const result = RESPONSE_REGEX.exec(lineToProcess);
            if (result && result.groups?.['response']) {
                try {
                    const responseLen = parseInt(result?.groups?.['response']);
                    // create a response object
                    const response = {
                        command: result.groups?.['command'],
                        response: (Number.isNaN(responseLen) ? result.groups?.['response'] : 'OK'),
                        message: result.groups?.['responseMsg'],
                        body: undefined,
                    };
                    // parse payload data if there is any
                    if (!Number.isNaN(responseLen)) {
                        const payloadData = this.processPayloadData(responseLen);
                        if (payloadData == null) {
                            // put the command back as we haven't received enough data
                            this._unprocessedLines.unshift(lineToProcess);
                            break;
                        }
                        else {
                            response.body = payloadData;
                        }
                    }
                    // now do something with response
                    this.emit('response', response);
                }
                catch (e) {
                    this.emit('error', e instanceof Error ? e : new Error(`Couldn't process the response: "${lineToProcess}"`));
                }
            }
            else if (lineToProcess.length > 0) {
                // there is some data, but we can't recognize it, emit an error
                this.emit('error', new Error(`Unknown response from vMix: "${lineToProcess}"`));
            }
            else {
                // empty lines we silently ignore
            }
        }
    }
    processPayloadData(responseLen) {
        const processedLines = [];
        while (responseLen > 0) {
            const line = this._unprocessedLines[processedLines.length];
            if (line == null) {
                // we have not received all the data from server, break line processing and wait for more data
                return null;
            }
            processedLines.push(line);
            responseLen -= Buffer.byteLength(line, 'utf-8') + 2;
        }
        this._unprocessedLines.splice(0, processedLines.length);
        return processedLines.join('\r\n');
    }
}
exports.VMixResponseStreamReader = VMixResponseStreamReader;
//# sourceMappingURL=vMixResponseStreamReader.js.map