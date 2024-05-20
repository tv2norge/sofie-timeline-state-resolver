"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Conductor = exports.AbortError = exports.Device = exports.MINTIMEUNIT = exports.MINTRIGGERTIME = exports.PREPARETIME = exports.LOOKAHEADTIME = exports.DeviceContainer = void 0;
const _ = require("underscore");
const superfly_timeline_1 = require("superfly-timeline");
const eventemitter3_1 = require("eventemitter3");
const threadedclass_1 = require("threadedclass");
const p_queue_1 = require("p-queue");
const PAll = require("p-all");
const p_timeout_1 = require("p-timeout");
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const doOnTime_1 = require("./devices/doOnTime");
const lib_1 = require("./lib");
const deviceContainer_1 = require("./devices/deviceContainer");
Object.defineProperty(exports, "DeviceContainer", { enumerable: true, get: function () { return deviceContainer_1.DeviceContainer; } });
const remoteDeviceInstance_1 = require("./service/remoteDeviceInstance");
exports.LOOKAHEADTIME = 5000; // Will look ahead this far into the future
exports.PREPARETIME = 2000; // Will prepare commands this time before the event is to happen
exports.MINTRIGGERTIME = 10; // Minimum time between triggers
exports.MINTIMEUNIT = 1; // Minimum unit of time
/** When resolving and the timeline has repeating objects, only resolve this far into the future */
const RESOLVE_LIMIT_TIME = 10000;
const FREEZE_LIMIT = 5000; // how long to wait before considering the child to be unresponsive
var device_1 = require("./devices/device");
Object.defineProperty(exports, "Device", { enumerable: true, get: function () { return device_1.Device; } });
const CALLBACK_WAIT_TIME = 50;
const REMOVE_TIMEOUT = 5000;
class AbortError extends Error {
    constructor() {
        super(...arguments);
        this.name = 'AbortError';
    }
}
exports.AbortError = AbortError;
/**
 * The Conductor class serves as the main class for interacting. It contains
 * methods for setting mappings, timelines and adding/removing devices. It keeps
 * track of when to resolve the timeline and updates the devices with new states.
 */
class Conductor extends eventemitter3_1.EventEmitter {
    constructor(options = {}) {
        super();
        this._logDebug = false;
        this._timeline = [];
        this._timelineSize = undefined;
        this._mappings = {};
        this._datastore = {};
        this._deviceStates = {};
        this.devices = new Map();
        this._nextResolveTime = 0;
        this._resolvedStates = {
            resolvedStates: null,
            resolveTime: 0,
        };
        this._isInitialized = false;
        this._multiThreadedResolver = false;
        this._useCacheWhenResolving = false;
        this._estimateResolveTimeMultiplier = 1;
        this._callbackInstances = new Map(); // key = instanceId
        this._triggerSendStartStopCallbacksTimeout = null;
        this._sentCallbacks = {};
        this._actionQueue = new p_queue_1.default({
            concurrency: 1,
        });
        this._statMeasureStart = 0;
        this._statMeasureReason = '';
        this._statReports = [];
        this._options = options;
        this._multiThreadedResolver = !!options.multiThreadedResolver;
        this._useCacheWhenResolving = !!options.useCacheWhenResolving;
        this._estimateResolveTimeMultiplier = options.estimateResolveTimeMultiplier || 1;
        if (options.getCurrentTime)
            this._getCurrentTime = options.getCurrentTime;
        this._interval = setInterval(() => {
            if (this.timeline) {
                this._resolveTimeline();
            }
        }, 2500);
        this._doOnTime = new doOnTime_1.DoOnTime(() => {
            return this.getCurrentTime();
        });
        this._doOnTime.on('error', (e) => this.emit('error', e));
        // this._doOnTime.on('callback', (...args) => {
        // 	this.emit('timelineCallback', ...args)
        // })
        if (options.autoInit) {
            this.init().catch((e) => {
                this.emit('error', 'Error during auto-init: ', e);
            });
        }
    }
    /**
     * Initializates the resolver, with optional multithreading
     */
    async init() {
        this._resolver = await (0, threadedclass_1.threadedClass)('../dist/AsyncResolver.js', 'AsyncResolver', [
            (r) => {
                this.emit('setTimelineTriggerTime', r);
            },
        ], {
            threadUsage: this._multiThreadedResolver ? 1 : 0,
            autoRestart: true,
            disableMultithreading: !this._multiThreadedResolver,
            instanceName: 'resolver',
        });
        threadedclass_1.ThreadedClassManager.onEvent(this._resolver, 'thread_closed', () => {
            // This is called if a child crashes - we are using autoRestart, so we just log
            this.emit('warning', 'AsyncResolver thread closed');
        });
        threadedclass_1.ThreadedClassManager.onEvent(this._resolver, 'restarted', () => {
            this.emit('warning', 'AsyncResolver thread restarted');
        });
        threadedclass_1.ThreadedClassManager.onEvent(this._resolver, 'error', (error) => {
            this.emit('error', 'AsyncResolver threadedClass error', error);
        });
        this._isInitialized = true;
        this.resetResolver();
    }
    /**
     * Returns a nice, synchronized time.
     */
    getCurrentTime() {
        if (this._getCurrentTime) {
            return this._getCurrentTime();
        }
        else {
            return Date.now();
        }
    }
    /**
     * Returns the mappings
     */
    get mapping() {
        return this._mappings;
    }
    /**
     * Returns the current timeline
     */
    get timeline() {
        return this._timeline;
    }
    /**
     * Sets a new timeline and resets the resolver.
     */
    setTimelineAndMappings(timeline, mappings) {
        this.statStartMeasure('timeline received');
        this._timeline = timeline;
        this._timelineSize = undefined; // reset the cache
        if (mappings)
            this._mappings = mappings;
        // We've got a new timeline, anything could've happened at this point
        // Highest priority right now is to determine if any commands have to be sent RIGHT NOW
        // After that, we'll move further ahead in time, creating commands ready for scheduling
        this.resetResolver();
    }
    get timelineHash() {
        return this._timelineHash;
    }
    set timelineHash(hash) {
        this._timelineHash = hash;
    }
    get logDebug() {
        return this._logDebug;
    }
    set logDebug(val) {
        this._logDebug = val;
        threadedclass_1.ThreadedClassManager.debug = this._logDebug;
    }
    get estimateResolveTimeMultiplier() {
        return this._estimateResolveTimeMultiplier;
    }
    set estimateResolveTimeMultiplier(value) {
        this._estimateResolveTimeMultiplier = value;
    }
    getDevices(includeUninitialized = false) {
        if (includeUninitialized) {
            return Array.from(this.devices.values());
        }
        else {
            return Array.from(this.devices.values()).filter((device) => device.initialized === true);
        }
    }
    getDevice(deviceId, includeUninitialized = false) {
        if (includeUninitialized) {
            return this.devices.get(deviceId);
        }
        else {
            const device = this.devices.get(deviceId);
            if (device?.initialized === true) {
                return device;
            }
            else {
                return undefined;
            }
        }
    }
    /**
     * Adds a device that can be referenced by the timeline and mappings.
     * NOTE: use this with caution! if a device fails to initialise (i.e. because the hardware is turned off) this may never resolve. It is preferred to use createDevice and initDevice separately for this reason.
     * @param deviceId Id used by the mappings to reference the device.
     * @param deviceOptions The options used to initalize the device
     * @returns A promise that resolves with the created device, or rejects with an error message.
     */
    async addDevice(deviceId, deviceOptions, activeRundownPlaylistId) {
        const newDevice = await this.createDevice(deviceId, deviceOptions);
        try {
            // Temporary listening to events, these are removed after the devide has been initiated.
            const instanceId = newDevice.instanceId;
            const onDeviceInfo = (...args) => {
                this.emit('info', instanceId, ...args);
            };
            const onDeviceWarning = (...args) => {
                this.emit('warning', instanceId, ...args);
            };
            const onDeviceError = (...args) => {
                this.emit('error', instanceId, ...args);
            };
            const onDeviceDebug = (...args) => {
                this.emit('debug', instanceId, ...args);
            };
            const onDeviceDebugState = (...args) => {
                this.emit('debugState', args);
            };
            newDevice.device.on('info', onDeviceInfo).catch(console.error);
            newDevice.device.on('warning', onDeviceWarning).catch(console.error);
            newDevice.device.on('error', onDeviceError).catch(console.error);
            newDevice.device.on('debug', onDeviceDebug).catch(console.error);
            newDevice.device.on('debugState', onDeviceDebugState).catch(console.error);
            const device = await this.initDevice(deviceId, deviceOptions, activeRundownPlaylistId);
            // Remove listeners, expect consumer to subscribe to them now.
            newDevice.device.removeListener('info', onDeviceInfo).catch(console.error);
            newDevice.device.removeListener('warning', onDeviceWarning).catch(console.error);
            newDevice.device.removeListener('error', onDeviceError).catch(console.error);
            newDevice.device.removeListener('debug', onDeviceDebug).catch(console.error);
            newDevice.device.removeListener('debugState', onDeviceDebugState).catch(console.error);
            return device;
        }
        catch (e) {
            await this.terminateUnwantedDevice(newDevice);
            this.devices.delete(deviceId);
            this.emit('error', 'conductor.addDevice', e);
            return Promise.reject(e);
        }
    }
    /**
     * Creates an uninitialised device that can be referenced by the timeline and mappings.
     * @param deviceId Id used by the mappings to reference the device.
     * @param deviceOptions The options used to initalize the device
     * @param options Additional options
     * @returns A promise that resolves with the created device, or rejects with an error message.
     */
    async createDevice(deviceId, deviceOptions, options) {
        let newDevice;
        try {
            const throwIfAborted = () => this.throwIfAborted(options?.signal, deviceId, 'creation');
            if (this.devices.has(deviceId)) {
                throw new Error(`Device "${deviceId}" already exists when creating device`);
            }
            throwIfAborted();
            const threadedClassOptions = {
                threadUsage: deviceOptions.threadUsage || 1,
                autoRestart: false,
                disableMultithreading: !deviceOptions.isMultiThreaded,
                instanceName: deviceId,
                freezeLimit: FREEZE_LIMIT,
            };
            const getCurrentTime = () => {
                return this.getCurrentTime();
            };
            const newDevicePromise = this.createDeviceContainer(deviceOptions, deviceId, getCurrentTime, threadedClassOptions);
            if (!newDevicePromise) {
                const type = deviceOptions.type;
                throw new Error(`No matching device type for "${type}" ("${timeline_state_resolver_types_1.DeviceType[type]}") found in conductor`);
            }
            newDevice = await makeImmediatelyAbortable(async () => {
                throwIfAborted();
                const newDevice = await newDevicePromise;
                if (options?.signal?.aborted) {
                    // if the promise above did not resolve before aborted,
                    // this executes some time after raceAbortable rejects, serving as a cleanup
                    await this.terminateUnwantedDevice(newDevice);
                    throw new AbortError(`Device "${deviceId}" creation aborted`);
                }
                return newDevice;
            }, options?.signal);
            newDevice.device.on('resetResolver', () => this.resetResolver()).catch(console.error);
            newDevice.on('error', (context, e) => {
                this.emit('error', `deviceContainer for "${newDevice?.deviceId}" emitted an error: ${context}, ${e}`);
            });
            // Double check that it hasnt been created while we were busy waiting
            if (this.devices.has(deviceId)) {
                throw new Error(`Device "${deviceId}" already exists when creating device`);
            }
            throwIfAborted();
        }
        catch (e) {
            await this.terminateUnwantedDevice(newDevice);
            this.emit('error', 'conductor.createDevice', e);
            throw e;
        }
        this.devices.set(deviceId, newDevice);
        return newDevice;
    }
    throwIfAborted(signal, deviceId, action) {
        if (signal?.aborted) {
            throw new AbortError(`Device "${deviceId}" ${action} aborted`);
        }
    }
    createDeviceContainer(deviceOptions, deviceId, getCurrentTime, threadedClassOptions) {
        switch (deviceOptions.type) {
            case timeline_state_resolver_types_1.DeviceType.ABSTRACT:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/abstract/index.js', 'AbstractDevice', deviceId, deviceOptions, getCurrentTime, {
                    ...threadedClassOptions,
                    threadUsage: deviceOptions.isMultiThreaded ? 0.1 : 0,
                });
            case timeline_state_resolver_types_1.DeviceType.CASPARCG:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/casparCG/index.js', 'CasparCGDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.ATEM:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/atem/index.js', 'AtemDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.HTTPWATCHER:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/httpWatcher/index.js', 'HTTPWatcherDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.LAWO:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/lawo/index.js', 'LawoDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.TCPSEND:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/tcpSend/index.js', 'TCPSendDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.PANASONIC_PTZ:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/panasonicPTZ/index.js', 'PanasonicPtzDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.HYPERDECK:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/hyperdeck/index.js', 'HyperdeckDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.PHAROS:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/pharos/index.js', 'PharosDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.QUANTEL:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/quantel/index.js', 'QuantelDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.SHOTOKU:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/shotoku/index.js', 'ShotokuDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.SISYFOS:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/sisyfos/index.js', 'SisyfosMessageDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.VIZMSE:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/vizMSE/index.js', 'VizMSEDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.SINGULAR_LIVE:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/singularLive/index.js', 'SingularLiveDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.VMIX:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/vmix/index.js', 'VMixDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.OBS:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/obs/index.js', 'OBSDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.TELEMETRICS:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/telemetrics/index.js', 'TelemetricsDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.SOFIE_CHEF:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/sofieChef/index.js', 'SofieChefDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.TRICASTER:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/tricaster/index.js', 'TriCasterDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.MULTI_OSC:
                return deviceContainer_1.DeviceContainer.create('../../dist/integrations/multiOsc/index.js', 'MultiOSCMessageDevice', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            case timeline_state_resolver_types_1.DeviceType.OSC:
            case timeline_state_resolver_types_1.DeviceType.HTTPSEND:
                // presumably this device is implemented in the new service handler
                return remoteDeviceInstance_1.RemoteDeviceInstance.create('../../dist/service/DeviceInstance.js', 'DeviceInstanceWrapper', deviceId, deviceOptions, getCurrentTime, threadedClassOptions);
            default:
                (0, lib_1.assertNever)(deviceOptions);
                return null;
        }
    }
    async terminateUnwantedDevice(newDevice) {
        await newDevice
            ?.terminate()
            .catch((e) => this.emit('error', `Cleanup failed of aborted device "${newDevice.deviceId}": ${e}`));
    }
    /**
     * Initialises an existing device that can be referenced by the timeline and mappings.
     * @param deviceId Id used by the mappings to reference the device.
     * @param deviceOptions The options used to initalize the device
     * @param activeRundownPlaylistId Id of the current rundown playlist
     * @param options Additional options
     * @returns A promise that resolves with the initialised device, or rejects with an error message.
     */
    async initDevice(deviceId, deviceOptions, activeRundownPlaylistId, options) {
        const throwIfAborted = () => this.throwIfAborted(options?.signal, deviceId, 'initialisation');
        throwIfAborted();
        const newDevice = this.devices.get(deviceId);
        if (!newDevice) {
            throw new Error('Could not find device ' + deviceId + ', has it been created?');
        }
        if (newDevice.initialized === true) {
            throw new Error('Device ' + deviceId + ' is already initialized!');
        }
        this.emit('info', `Initializing device ${newDevice.deviceId} (${newDevice.instanceId}) of type ${timeline_state_resolver_types_1.DeviceType[deviceOptions.type]}...`);
        return makeImmediatelyAbortable(async () => {
            throwIfAborted();
            await newDevice.init(deviceOptions.options, activeRundownPlaylistId);
            throwIfAborted();
            await newDevice.reloadProps();
            throwIfAborted();
            this.emit('info', `Device ${newDevice.deviceId} (${newDevice.instanceId}) initialized!`);
            return newDevice;
        }, options?.signal);
    }
    /**
     * Safely remove a device
     * @param deviceId The id of the device to be removed
     */
    async removeDevice(deviceId) {
        const device = this.devices.get(deviceId);
        if (device) {
            try {
                await Promise.race([
                    device.device.terminate(),
                    new Promise((_, reject) => setTimeout(() => reject('Timeout'), REMOVE_TIMEOUT)),
                ]);
            }
            catch (e) {
                // An error while terminating is probably not that important, since we'll kill the instance anyway
                this.emit('warning', `Error when terminating device ${e}`);
            }
            await device.terminate();
            this.devices.delete(deviceId);
        }
        else {
            return Promise.reject('No device found');
        }
    }
    /**
     * Remove all devices
     */
    async destroy() {
        clearTimeout(this._interval);
        if (this._triggerSendStartStopCallbacksTimeout)
            clearTimeout(this._triggerSendStartStopCallbacksTimeout);
        await this._mapAllDevices(true, async (d) => this.removeDevice(d.deviceId));
    }
    /**
     * Resets the resolve-time, so that the resolving will happen for the point-in time NOW
     * next time
     */
    resetResolver() {
        // reset the resolver through the action queue to make sure it is reset after any currently running timelineResolves
        this._actionQueue
            .add(async () => {
            this._nextResolveTime = 0; // This will cause _resolveTimeline() to generate the state for NOW
            this._resolvedStates = {
                resolvedStates: null,
                resolveTime: 0,
            };
        })
            .catch(() => {
            this.emit('error', 'Failed to reset the resolvedStates, timeline may not be updated appropriately!');
        });
        this._triggerResolveTimeline();
    }
    /**
     * Send a makeReady-trigger to all devices
     *
     * @deprecated replace by TSR actions
     */
    async devicesMakeReady(okToDestroyStuff, activationId) {
        this.activationId = activationId;
        this.emit('debug', `devicesMakeReady, ${okToDestroyStuff ? 'okToDestroyStuff' : 'undefined'}, ${activationId ? activationId : 'undefined'}`);
        await this._actionQueue.add(async () => {
            await this._mapAllDevices(false, async (d) => (0, p_timeout_1.default)((async () => {
                const trace = (0, lib_1.startTrace)('conductor:makeReady:' + d.deviceId);
                await d.device.makeReady(okToDestroyStuff, activationId);
                this.emit('timeTrace', (0, lib_1.endTrace)(trace));
            })(), 10000, `makeReady for "${d.deviceId}" timed out`));
            this._triggerResolveTimeline();
        });
    }
    /**
     * Send a standDown-trigger to all devices
     *
     * @deprecated replaced by TSR actions
     */
    async devicesStandDown(okToDestroyStuff) {
        this.activationId = undefined;
        this.emit('debug', `devicesStandDown, ${okToDestroyStuff ? 'okToDestroyStuff' : 'undefined'}`);
        await this._actionQueue.add(async () => {
            await this._mapAllDevices(false, async (d) => (0, p_timeout_1.default)((async () => {
                const trace = (0, lib_1.startTrace)('conductor:standDown:' + d.deviceId);
                await d.device.standDown(okToDestroyStuff);
                this.emit('timeTrace', (0, lib_1.endTrace)(trace));
            })(), 10000, `standDown for "${d.deviceId}" timed out`));
        });
    }
    async getThreadsMemoryUsage() {
        return threadedclass_1.ThreadedClassManager.getThreadsMemoryUsage();
    }
    async _mapAllDevices(includeUninitialized, fcn) {
        return PAll(this.getDevices(true)
            .filter((d) => includeUninitialized || d.initialized === true)
            .map((d) => async () => fcn(d)), {
            stopOnError: false,
        });
    }
    /**
     * This is the main resolve-loop.
     */
    _triggerResolveTimeline(timeUntilTrigger) {
        // this.emit('info', '_triggerResolveTimeline', timeUntilTrigger)
        if (this._resolveTimelineTrigger) {
            clearTimeout(this._resolveTimelineTrigger);
            delete this._resolveTimelineTrigger;
        }
        if (timeUntilTrigger) {
            // resolve at a later stage
            this._resolveTimelineTrigger = setTimeout(() => {
                this._resolveTimeline();
            }, timeUntilTrigger);
        }
        else {
            // resolve right away:
            this._resolveTimeline();
        }
    }
    /**
     * Resolves the timeline for the next resolve-time, generates the commands and passes on the commands.
     */
    _resolveTimeline() {
        // this adds it to a queue, make sure it never runs more than once at a time:
        this._actionQueue
            .add(async () => {
            return this._resolveTimelineInner()
                .then((nextResolveTime) => {
                this._nextResolveTime = nextResolveTime || 0;
            })
                .catch((e) => {
                this.emit('error', 'Caught error in _resolveTimelineInner' + e);
            });
        })
            .catch((e) => {
            this.emit('error', 'Caught error in _resolveTimeline.then' + e);
        });
    }
    async _resolveTimelineInner() {
        const trace = (0, lib_1.startTrace)('conductor:resolveTimeline');
        if (!this._isInitialized) {
            this.emit('warning', 'TSR is not initialized yet');
            return undefined;
        }
        let nextResolveTime = 0;
        let timeUntilNextResolve = exports.LOOKAHEADTIME;
        const startTime = Date.now();
        const statMeasureStart = this._statMeasureStart;
        let statTimeStateHandled = -1;
        let statTimeTimelineStartResolve = -1;
        let statTimeTimelineResolved = -1;
        let estimatedResolveTime = -1;
        try {
            /** The point in time this function is run. ( ie "right now") */
            const now = this.getCurrentTime();
            /** The point in time we're targeting. (This can be in the future) */
            let resolveTime = this._nextResolveTime;
            estimatedResolveTime = this.estimateResolveTime();
            if (resolveTime === 0 || // About to be resolved ASAP
                resolveTime < now + estimatedResolveTime // We're late
            ) {
                resolveTime = now + estimatedResolveTime;
                this.emitWhenActive('debug', `resolveTimeline ${resolveTime} (${resolveTime - now} from now) (${estimatedResolveTime}) ---------`);
            }
            else {
                this.emitWhenActive('debug', `resolveTimeline ${resolveTime} (${resolveTime - now} from now) -----------------------------`);
                if (resolveTime > now + exports.LOOKAHEADTIME) {
                    // If the resolveTime is too far ahead, we'd rather wait and resolve it later.
                    this.emitWhenActive('debug', 'Too far ahead (' + resolveTime + ')');
                    this._triggerResolveTimeline(exports.LOOKAHEADTIME);
                    return undefined;
                }
            }
            // Let all initialized devices know that a new state is about to come in.
            // This is done so that they can clear future commands a bit earlier, possibly avoiding double or conflicting commands
            // const pPrepareForHandleStates = this._mapAllDevices(async (device: DeviceContainer) => {
            // 	await device.device.prepareForHandleState(resolveTime)
            // }).catch(error => {
            // 	this.emit('error', error)
            // })
            // TODO - the PAll way of doing this provokes https://github.com/nrkno/tv-automation-state-timeline-resolver/pull/139
            // The doOnTime calls fire before this, meaning we cleanup the state for a time we have already sent commands for
            const pPrepareForHandleStates = Promise.all(Array.from(this.devices.values())
                .filter((d) => d.initialized === true)
                .map(async (device) => {
                await device.device.prepareForHandleState(resolveTime);
            })).catch((error) => {
                this.emit('error', error);
            });
            const applyRecursively = (o, func) => {
                func(o);
                if (o.isGroup) {
                    _.each(o.children || [], (child) => {
                        applyRecursively(child, func);
                    });
                }
            };
            statTimeTimelineStartResolve = Date.now();
            const timeline = this.timeline;
            // To prevent trying to transfer circular references over IPC we remove
            // any references to the parent property:
            const deleteParent = (o) => {
                if ('parent' in o) {
                    delete o['parent'];
                }
            };
            _.each(timeline, (o) => applyRecursively(o, deleteParent));
            // Determine if we can use the pre-resolved timeline:
            let resolvedStates;
            if (this._resolvedStates.resolvedStates &&
                resolveTime >= this._resolvedStates.resolveTime &&
                resolveTime < this._resolvedStates.resolveTime + RESOLVE_LIMIT_TIME) {
                // Yes, we can use the previously resolved timeline:
                resolvedStates = this._resolvedStates.resolvedStates;
            }
            else {
                // No, we need to resolve the timeline again:
                const o = await this._resolver.resolveTimeline(resolveTime, timeline, resolveTime + RESOLVE_LIMIT_TIME, this._useCacheWhenResolving);
                resolvedStates = o.resolvedStates;
                this._resolvedStates.resolvedStates = resolvedStates;
                this._resolvedStates.resolveTime = resolveTime;
                // Apply changes to fixed objects (set "now" triggers to an actual time):
                // This gets persisted on this.timeline, so we only have to do this once
                const nowIdsTime = {};
                _.each(o.objectsFixed, (o) => (nowIdsTime[o.id] = o.time));
                const fixNow = (o) => {
                    if (nowIdsTime[o.id]) {
                        if (!_.isArray(o.enable)) {
                            o.enable.start = nowIdsTime[o.id];
                        }
                    }
                };
                _.each(timeline, (o) => applyRecursively(o, fixNow));
            }
            const tlState = superfly_timeline_1.Resolver.getState(resolvedStates, resolveTime);
            await pPrepareForHandleStates;
            statTimeTimelineResolved = Date.now();
            if (this.getCurrentTime() > resolveTime) {
                this.emit('warning', `Resolver is ${this.getCurrentTime() - resolveTime} ms late (estimatedResolveTime was ${estimatedResolveTime})`);
            }
            const tlStateLayers = tlState.layers; // This is a cast, but only for the `content`
            const layersPerDevice = this.filterLayersPerDevice(tlStateLayers, Array.from(this.devices.values()).filter((d) => d.initialized === true));
            // Push state to the right device:
            await this._mapAllDevices(false, async (device) => {
                if (this._options.optimizeForProduction) {
                    // Don't send any state to the abstract device, since it doesn't do anything anyway
                    if (device.deviceType === timeline_state_resolver_types_1.DeviceType.ABSTRACT)
                        return;
                }
                // The subState contains only the parts of the state relevant to that device:
                const subState = {
                    time: tlState.time,
                    layers: layersPerDevice[device.deviceId] || {},
                    nextEvents: [],
                };
                // Pass along the state to the device, it will generate its commands and execute them:
                try {
                    // await device.device.handleState(removeParentFromState(subState), this._mappings)
                    await this._setDeviceState(device.deviceId, tlState.time, removeParentFromState(subState), this._mappings);
                }
                catch (e) {
                    this.emit('error', 'Error in device "' + device.deviceId + '"' + e + ' ' + e.stack);
                }
            });
            statTimeStateHandled = Date.now();
            // Now that we've handled this point in time, it's time to determine what the next point in time is:
            let nextEventTime = null;
            _.each(tlState.nextEvents, (event) => {
                if (event.time && event.time > now && (!nextEventTime || event.time < nextEventTime)) {
                    nextEventTime = event.time;
                }
            });
            const nowPostExec = this.getCurrentTime();
            if (nextEventTime) {
                timeUntilNextResolve = Math.max(exports.MINTRIGGERTIME, // At minimum, we should wait this time
                Math.min(exports.LOOKAHEADTIME, // We should wait maximum this time, because we might have deferred a resolving this far ahead
                RESOLVE_LIMIT_TIME, // We should wait maximum this time, because we've only resolved repeating objects this far
                nextEventTime - nowPostExec - exports.PREPARETIME));
                // resolve at nextEventTime next time:
                nextResolveTime = Math.min(tlState.time + exports.LOOKAHEADTIME, nextEventTime);
            }
            else {
                // there's nothing ahead in the timeline,
                // Tell the devices that the future is clear:
                await this._mapAllDevices(true, async (device) => {
                    try {
                        await device.device.clearFuture(tlState.time);
                    }
                    catch (e) {
                        this.emit('error', 'Error in device "' + device.deviceId + '", clearFuture: ' + e + ' ' + e.stack);
                    }
                });
                // resolve at this time then next time (or later):
                nextResolveTime = Math.min(tlState.time);
            }
            // Special function: send callback to Core
            this._doOnTime.clearQueueNowAndAfter(tlState.time);
            const activeObjects = {};
            _.each(tlState.layers, (instance) => {
                try {
                    if (instance.content.callBack || instance.content.callBackStopped) {
                        const callBackId = instance.id +
                            instance.content.callBack +
                            instance.content.callBackStopped +
                            (instance.instance.originalStart ?? instance.instance.start) +
                            JSON.stringify(instance.content.callBackData);
                        activeObjects[callBackId] = {
                            time: instance.instance.start || 0,
                            id: instance.id,
                            callBack: instance.content.callBack,
                            callBackStopped: instance.content.callBackStopped,
                            callBackData: instance.content.callBackData,
                            startTime: instance.instance.start,
                        };
                    }
                }
                catch (e) {
                    this.emit('error', `callback to core, obj "${instance.id}"`, e);
                }
            });
            this._doOnTime.queue(tlState.time, undefined, (sentCallbacksNew) => {
                this._diffStateForCallbacks(sentCallbacksNew, tlState.time);
            }, activeObjects);
            const resolveDuration = Date.now() - startTime;
            // Special / hack: report back, for latency statitics:
            if (this._timelineHash) {
                this.emit('resolveDone', this._timelineHash, resolveDuration);
            }
            this.emitWhenActive('debug', 'resolveTimeline at time ' + resolveTime + ' done in ' + resolveDuration + 'ms (size: ' + timeline.length + ')');
        }
        catch (e) {
            this.emit('error', 'resolveTimeline' + e + '\nStack: ' + e.stack);
        }
        // Report time taken to resolve
        this.emit('timeTrace', (0, lib_1.endTrace)(trace));
        this.statReport(statMeasureStart, {
            timelineStartResolve: statTimeTimelineStartResolve,
            timelineSize: this.getTimelineSize(),
            timelineSizeOld: this._timeline.length,
            timelineResolved: statTimeTimelineResolved,
            stateHandled: statTimeStateHandled,
            done: Date.now(),
            estimatedResolveTime: estimatedResolveTime,
        });
        // Try to trigger the next resolval
        try {
            this._triggerResolveTimeline(timeUntilNextResolve);
        }
        catch (e) {
            this.emit('error', 'triggerResolveTimeline', e);
        }
        return nextResolveTime;
    }
    async _setDeviceState(deviceId, time, state, mappings) {
        if (!this._deviceStates[deviceId])
            this._deviceStates[deviceId] = [];
        // find all references to the datastore that are in this state
        const dependenciesSet = new Set();
        for (const { content } of Object.values(state.layers)) {
            const dataStoreContent = content;
            for (const r of Object.values(dataStoreContent.$references || {})) {
                dependenciesSet.add(r.datastoreKey);
            }
        }
        const dependencies = Array.from(dependenciesSet);
        // store all states between the current state and the new state
        this._deviceStates[deviceId] = _.compact([
            this._deviceStates[deviceId].reverse().find((s) => s.time <= this.getCurrentTime()),
            ...this._deviceStates[deviceId]
                .reverse()
                .filter((s) => s.time < time && s.time > this.getCurrentTime())
                .reverse(),
            {
                time,
                state,
                dependencies,
                mappings,
            },
        ]);
        // replace references to the timeline datastore with the actual values
        const filledState = (0, lib_1.fillStateFromDatastore)(state, this._datastore);
        // send the filled state to the device handler
        return this.getDevice(deviceId)?.device.handleState(filledState, mappings);
    }
    setDatastore(newStore) {
        this._actionQueue
            .add(() => {
            const allKeys = new Set([...Object.keys(newStore), ...Object.keys(this._datastore)]);
            const affectedDevices = [];
            for (const key of allKeys) {
                if (this._datastore[key]?.value !== newStore[key]?.value) {
                    // it changed! let's sift through our dependencies to see if we need to do anything
                    Object.entries(this._deviceStates).forEach(([deviceId, states]) => {
                        if (states.find((state) => state.dependencies.find((dep) => dep === key))) {
                            affectedDevices.push(deviceId);
                        }
                    });
                }
            }
            this._datastore = newStore;
            for (const deviceId of affectedDevices) {
                const toBeFilled = _.compact([
                    // shallow clone so we don't reverse the array in place
                    [...this._deviceStates[deviceId]].reverse().find((s) => s.time <= this.getCurrentTime()),
                    ...this._deviceStates[deviceId].filter((s) => s.time > this.getCurrentTime()), // all states after now
                ]);
                for (const s of toBeFilled) {
                    const filledState = (0, lib_1.fillStateFromDatastore)(s.state, this._datastore);
                    this.getDevice(deviceId)
                        ?.device.handleState(filledState, s.mappings)
                        .catch((e) => this.emit('error', 'resolveTimeline' + e + '\nStack: ' + e.stack));
                }
            }
        })
            .catch((e) => {
            this.emit('error', 'Caught error in setDatastore' + e);
        });
    }
    getTimelineSize() {
        if (this._timelineSize === undefined) {
            // Update the cache:
            this._timelineSize = this.getTimelineSizeInner(this._timeline);
        }
        return this._timelineSize;
    }
    getTimelineSizeInner(timelineObjects) {
        let size = 0;
        size += timelineObjects.length;
        for (const obj of timelineObjects) {
            if (obj.children) {
                size += this.getTimelineSizeInner(obj.children);
            }
            if (obj.keyframes) {
                size += obj.keyframes.length;
            }
        }
        return size;
    }
    /**
     * Returns a time estimate for the resolval duration based on the amount of
     * objects on the timeline. If the proActiveResolve option is falsy this
     * returns 0.
     */
    estimateResolveTime() {
        if (this._options.proActiveResolve) {
            const objectCount = this.getTimelineSize();
            return Conductor.calculateResolveTime(objectCount, this._estimateResolveTimeMultiplier);
        }
        else {
            return 0;
        }
    }
    /** Calculates the estimated time it'll take to resolve a timeline of a certain size */
    static calculateResolveTime(timelineSize, multiplier) {
        // Note: The LEVEL should really be a dynamic value, to reflect the actual performance of the hardware this is running on.
        const BASE_VALUE = 0;
        const LEVEL = 250;
        const EXPONENT = 0.7;
        const MIN_VALUE = 20;
        const MAX_VALUE = 200;
        const sizeFactor = Math.pow(timelineSize / LEVEL, EXPONENT) * LEVEL * 0.5; // a pretty nice-looking graph that levels out when objectCount is larger
        return (multiplier *
            Math.max(MIN_VALUE, Math.min(MAX_VALUE, Math.floor(BASE_VALUE + sizeFactor // add ms for every object (ish) in timeline
            ))));
    }
    _diffStateForCallbacks(activeObjects, tlTime) {
        // Clear callbacks scheduled after the current tlState
        for (const [callbackId, o] of Object.entries(this._sentCallbacks)) {
            if (o.time >= tlTime) {
                delete this._sentCallbacks[callbackId];
            }
        }
        // Send callbacks for playing objects:
        for (const [callbackId, cb] of Object.entries(activeObjects)) {
            if (cb.callBack && cb.startTime) {
                if (!this._sentCallbacks[callbackId]) {
                    // Object has started playing
                    this._queueCallback(true, {
                        type: 'start',
                        time: cb.startTime,
                        instanceId: cb.id,
                        callBack: cb.callBack,
                        callBackData: cb.callBackData,
                    });
                }
                else {
                    // callback already sent, do nothing
                }
            }
        }
        // Send callbacks for stopped objects
        for (const [callbackId, cb] of Object.entries(this._sentCallbacks)) {
            if (cb.callBackStopped && !activeObjects[callbackId]) {
                // Object has stopped playing
                this._queueCallback(false, {
                    type: 'stop',
                    time: tlTime,
                    instanceId: cb.id,
                    callBack: cb.callBackStopped,
                    callBackData: cb.callBackData,
                });
            }
        }
        this._sentCallbacks = activeObjects;
    }
    _queueCallback(playing, cb) {
        let o;
        if (this._callbackInstances.has(cb.instanceId)) {
            o = this._callbackInstances.get(cb.instanceId);
        }
        else {
            o = {
                playing: undefined,
                playChanged: false,
                endChanged: false,
            };
            this._callbackInstances.set(cb.instanceId, o);
        }
        if (o.playing !== playing) {
            this.emitWhenActive('debug', `_queueCallback ${playing ? 'playing' : 'stopping'} instance ${cb.instanceId}`);
            if (playing) {
                if (o.endChanged && o.endTime && Math.abs(cb.time - o.endTime) < CALLBACK_WAIT_TIME) {
                    // Too little time has passed since last time. Annihilate that event instead:
                    o.playing = playing;
                    o.endTime = undefined;
                    o.endCallback = undefined;
                    o.endChanged = false;
                }
                else {
                    o.playing = playing;
                    o.playChanged = true;
                    o.playTime = cb.time;
                    o.playCallback = cb;
                }
            }
            else {
                if (o.playChanged && o.playTime && Math.abs(cb.time - o.playTime) < CALLBACK_WAIT_TIME) {
                    // Too little time has passed since last time. Annihilate that event instead:
                    o.playing = playing;
                    o.playTime = undefined;
                    o.playCallback = undefined;
                    o.playChanged = false;
                }
                else {
                    o.playing = playing;
                    o.endChanged = true;
                    o.endTime = cb.time;
                    o.endCallback = cb;
                }
            }
        }
        else {
            this.emit('warning', `_queueCallback ${playing ? 'playing' : 'stopping'} instance ${cb.instanceId} already playing/stopped`);
        }
        this._triggerSendStartStopCallbacks();
    }
    _triggerSendStartStopCallbacks() {
        if (!this._triggerSendStartStopCallbacksTimeout) {
            this._triggerSendStartStopCallbacksTimeout = setTimeout(() => {
                this._triggerSendStartStopCallbacksTimeout = null;
                this._sendStartStopCallbacks();
            }, CALLBACK_WAIT_TIME);
        }
    }
    _sendStartStopCallbacks() {
        const now = this.getCurrentTime();
        let haveThingsToSendLater = false;
        const callbacks = [];
        for (const [instanceId, o] of this._callbackInstances.entries()) {
            if (o.endChanged && o.endTime && o.endCallback) {
                if (o.endTime < now - CALLBACK_WAIT_TIME) {
                    callbacks.push(o.endCallback);
                    o.endChanged = false;
                }
                else {
                    haveThingsToSendLater = true;
                }
            }
            if (o.playChanged && o.playTime && o.playCallback) {
                if (o.playTime < now - CALLBACK_WAIT_TIME) {
                    callbacks.push(o.playCallback);
                    o.playChanged = false;
                }
                else {
                    haveThingsToSendLater = true;
                }
            }
            if (!haveThingsToSendLater && !o.playChanged && !o.endChanged) {
                this._callbackInstances.delete(instanceId);
            }
        }
        // Sort the callbacks:
        const callbacksArray = callbacks.sort((a, b) => {
            if (a.type === 'start' && b.type !== 'start')
                return 1;
            if (a.type !== 'start' && b.type === 'start')
                return -1;
            if ((a.time || 0) > (b.time || 0))
                return 1;
            if ((a.time || 0) < (b.time || 0))
                return -1;
            return 0;
        });
        // emit callbacks
        _.each(callbacksArray, (cb) => {
            this.emit('timelineCallback', cb.time, cb.instanceId, cb.callBack, cb.callBackData);
        });
        if (haveThingsToSendLater) {
            this._triggerSendStartStopCallbacks();
        }
    }
    statStartMeasure(reason) {
        // Start a measure of response times
        if (!this._statMeasureStart) {
            this._statMeasureStart = Date.now();
            this._statMeasureReason = reason;
        }
    }
    statReport(startTime, report) {
        // Check if the report is from the start of a measuring
        if (this._statMeasureStart && this._statMeasureStart === startTime) {
            // Save the report:
            const reportDuration = {
                reason: this._statMeasureReason,
                timelineStartResolve: report.timelineStartResolve - startTime,
                timelineResolved: report.timelineResolved - startTime,
                stateHandled: report.stateHandled - startTime,
                done: report.done - startTime,
                timelineSize: report.timelineSize,
                timelineSizeOld: report.timelineSizeOld,
                estimatedResolveTime: report.estimatedResolveTime,
            };
            this._statReports.push(reportDuration);
            this._statMeasureStart = 0;
            this._statMeasureReason = '';
            this.emit('debug', 'statReport', JSON.stringify(reportDuration));
            this.emit('statReport', reportDuration);
        }
    }
    /**
     * Split the state into substates that are relevant for each device
     */
    filterLayersPerDevice(layers, devices) {
        const filteredStates = {};
        const deviceIdAndTypes = {};
        _.each(devices, (device) => {
            deviceIdAndTypes[device.deviceId + '__' + device.deviceType] = device.deviceId;
        });
        _.each(layers, (o, layerId) => {
            const oExt = o;
            let mapping = this._mappings[o.layer + ''];
            if (!mapping && oExt.isLookahead && oExt.lookaheadForLayer) {
                mapping = this._mappings[oExt.lookaheadForLayer];
            }
            if (mapping) {
                const deviceIdAndType = mapping.deviceId + '__' + mapping.device;
                if (deviceIdAndTypes[deviceIdAndType]) {
                    if (!filteredStates[mapping.deviceId]) {
                        filteredStates[mapping.deviceId] = {};
                    }
                    filteredStates[mapping.deviceId][layerId] = o;
                }
            }
        });
        return filteredStates;
    }
    /**
     * Only emits the event when there is an active rundownPlaylist.
     * This is used to reduce unnesessary logging
     */
    emitWhenActive(eventType, ...args) {
        if (this.activationId) {
            this.emit(eventType, ...args);
        }
    }
}
exports.Conductor = Conductor;
function removeParentFromState(o) {
    for (const key in o) {
        if (key === 'parent') {
            delete o['parent'];
        }
        else if (typeof o[key] === 'object') {
            o[key] = removeParentFromState(o[key]);
        }
    }
    return o;
}
/**
 * If aborted, rejects as soon as possible, but lets the wraped function safely resolve or reject on its own
 * @param func async function to wrap
 * @param abortSignal the AbortSignal
 * @returns Promise of the same type as `func`
 */
async function makeImmediatelyAbortable(func, abortSignal) {
    const mainPromise = func(abortSignal);
    if (!abortSignal) {
        return mainPromise;
    }
    let resolveAbortPromise;
    const abortPromise = new Promise((resolve, reject) => {
        resolveAbortPromise = () => {
            resolve();
            // @ts-expect-error removeEventListener is missing in @types/node until 16.x
            abortSignal.removeEventListener('abort', rejectPromise);
        };
        const rejectPromise = () => {
            reject(new AbortError());
        };
        // @ts-expect-error addEventListener is missing in @types/node until 16.x
        abortSignal.addEventListener('abort', rejectPromise, { once: true });
    });
    return Promise.race([mainPromise, abortPromise])
        .then((result) => {
        // only mainPromise could have resolved, so the result must be T
        resolveAbortPromise();
        return result;
    })
        .catch((reason) => {
        // mainPromise or abortPromise might have rejected; calling resolveAbortPromise in the latter case is safe
        resolveAbortPromise();
        throw reason;
    });
}
//# sourceMappingURL=conductor.js.map