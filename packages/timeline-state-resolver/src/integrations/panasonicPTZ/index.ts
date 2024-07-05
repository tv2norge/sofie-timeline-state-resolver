import * as _ from 'underscore'
import { DeviceWithState, CommandWithContext, DeviceStatus, StatusCode } from '../../devices/device'
import {
	DeviceType,
	TimelineContentTypePanasonicPtz,
	SomeMappingPanasonicPTZ,
	MappingPanasonicPTZType,
	PanasonicPTZOptions,
	DeviceOptionsPanasonicPTZ,
	Mappings,
	TSRTimelineContent,
	Timeline,
	Mapping,
	ActionExecutionResultCode,
	ActionExecutionResult,
	RecallPresetPayload,
	StorePresetPayload,
	ResetPresetPayload,
	StartPanTiltPayload,
	StartZoomPayload,
	StartFocusPayload,
	SetFocusModePayload,
	PanTiltDirection,
	ZoomDirection,
	FocusDirection,
	FocusMode,
} from 'timeline-state-resolver-types'
import { DoOnTime, SendMode } from '../../devices/doOnTime'
import { PanasonicFocusMode, PanasonicPtzHttpInterface } from './connection'
import { PanasonicPTZActions } from 'timeline-state-resolver-types/src'
import { t } from '../../lib'
import {
	AutoFocusOnOffControl,
	AutoFocusOnOffQuery,
	Command,
	FocusPositionQuery,
	FocusSpeedControl,
	OneTouchFocusControl,
	PanTiltPositionQuery,
	PanTiltSpeedControl,
	PowerMode,
	PresetDeleteControl,
	PresetPlaybackControl,
	PresetRegisterControl,
	PresetSpeedControl,
	ZoomPositionControl,
	ZoomPositionQuery,
	ZoomSpeedControl,
} from './commands'

export interface DeviceOptionsPanasonicPTZInternal extends DeviceOptionsPanasonicPTZ {
	commandReceiver?: CommandReceiver
}
export type CommandReceiver = (
	time: number,
	cmd: PanasonicPtzCommand,
	context: CommandContext,
	timelineObjId: string
) => Promise<any>

export interface PanasonicPtzState {
	speed?: {
		value: number
		timelineObjId: string
	}
	preset?: {
		value: number
		timelineObjId: string
	}
	zoomSpeed?: {
		value: number
		timelineObjId: string
	}
	zoom?: {
		value: number
		timelineObjId: string
	}
}

export interface PanasonicPtzCommand {
	type: TimelineContentTypePanasonicPtz
	speed?: number
	preset?: number
	zoomSpeed?: number // -1 is full speed WIDE, +1 is full speed TELE, 0 is stationary
	zoom?: number // 0 is WIDE, 1 is TELE
}
export interface PanasonicPtzCommandWithContext {
	command: PanasonicPtzCommand
	context: CommandContext
	timelineObjId: string
}
type CommandContext = any

const PROBE_INTERVAL = 10 * 1000 // Probe every 10s

const COMMAND_PRIORITY: Record<PanasonicPtzCommand['type'], number> = {
	presetSpeed: 0,
	zoomSpeed: 1,
	zoom: 2,
	presetMem: 3,
}

const FOCUS_MODE_MAP = {
	[FocusMode.AUTO]: PanasonicFocusMode.AUTO,
	[FocusMode.MANUAL]: PanasonicFocusMode.MANUAL,
}

/**
 * A wrapper for panasonic ptz cameras. Maps timeline states to device states and
 * executes commands to achieve such states. Depends on PanasonicPTZAPI class for
 * connection with the physical device.
 */
export class PanasonicPtzDevice extends DeviceWithState<PanasonicPtzState, DeviceOptionsPanasonicPTZInternal> {
	private _doOnTime: DoOnTime
	private _device: PanasonicPtzHttpInterface | undefined
	private _connected = false

	private _commandReceiver: CommandReceiver
	private _pingInterval: NodeJS.Timer

	constructor(
		deviceId: string,
		deviceOptions: DeviceOptionsPanasonicPTZInternal,
		getCurrentTime: () => Promise<number>
	) {
		super(deviceId, deviceOptions, getCurrentTime)
		if (deviceOptions.options) {
			if (deviceOptions.commandReceiver) {
				this._commandReceiver = deviceOptions.commandReceiver
			} else {
				this._commandReceiver = this._defaultCommandReceiver.bind(this)
			}
		}
		this._doOnTime = new DoOnTime(
			() => {
				return this.getCurrentTime()
			},
			SendMode.BURST,
			this._deviceOptions
		)
		this.handleDoOnTime(this._doOnTime, 'PanasonicPTZ')

		if (!deviceOptions.options || !deviceOptions.options.host) {
			this._device = undefined
			return
		}

		// set up connection class
		this._device = new PanasonicPtzHttpInterface(
			deviceOptions.options.host,
			deviceOptions.options.port,
			deviceOptions.options.https
		)
		this._device.on('error', (msg) => {
			if (msg.code === 'ECONNREFUSED') return // ignore, since we catch this in connection logic
			this.emit('error', 'PanasonicPtzHttpInterface', msg)
		})
		this._device.on('disconnected', () => {
			this._setConnected(false)
		})
		this._device.on('debug', (...args) => {
			this.emitDebug('Panasonic PTZ', ...args)
		})
	}

	/**
	 * Initiates the device: set up ping for connection logic.
	 */
	async init(_initOptions: PanasonicPTZOptions): Promise<boolean> {
		if (!this._device) {
			return Promise.reject('There are no cameras set up for this device')
		}

		return new Promise((resolve, reject) => {
			this._pingInterval = setInterval(() => {
				if (!this._device) {
					this.emit('error', `init() interval`, new Error(`Device handler for "${this.deviceId}" not defined`))
					return
				}

				this._device
					.ping()
					.then((result) => {
						this._setConnected(result !== PowerMode.POWER_MODE_STBY)
					})
					.catch(() => {
						this._setConnected(false)
					})
			}, PROBE_INTERVAL)

			if (!this._device) {
				throw new Error(`Device handler for "${this.deviceId}" not defined`)
			}

			this._device
				.ping()
				.then((result) => {
					this._setConnected(!!result)

					resolve(true)
				})
				.catch((e) => {
					reject(e)
				})
		})
	}

	actions: Record<string, (id: PanasonicPTZActions, payload?: Record<string, any>) => Promise<ActionExecutionResult>> =
		{
			[PanasonicPTZActions.RecallPreset]: async (
				_id: PanasonicPTZActions.RecallPreset,
				payload: RecallPresetPayload
			) => {
				return this.safelyExecuteActionCommand(() => new PresetPlaybackControl(payload.presetNumber))
			},
			[PanasonicPTZActions.StorePreset]: async (_id: PanasonicPTZActions.StorePreset, payload: StorePresetPayload) => {
				return this.safelyExecuteActionCommand(() => new PresetRegisterControl(payload.presetNumber))
			},
			[PanasonicPTZActions.ResetPreset]: async (_id: PanasonicPTZActions.ResetPreset, payload: ResetPresetPayload) => {
				return this.safelyExecuteActionCommand(() => new PresetDeleteControl(payload.presetNumber))
			},
			[PanasonicPTZActions.StartPanTilt]: async (
				_id: PanasonicPTZActions.StartPanTilt,
				payload: StartPanTiltPayload
			) => {
				const { panSpeed, tiltSpeed } = this.mapPanTiltSpeedToPanasonic(
					payload.panSpeed,
					payload.tiltSpeed,
					payload.direction
				)
				return this.safelyExecuteActionCommand(() => new PanTiltSpeedControl(panSpeed, tiltSpeed))
			},
			[PanasonicPTZActions.StopPanTilt]: async (_id: PanasonicPTZActions.StopPanTilt) => {
				const { panSpeed, tiltSpeed } = this.mapPanTiltSpeedToPanasonic(0, 0)
				return this.safelyExecuteActionCommand(() => new PanTiltSpeedControl(panSpeed, tiltSpeed))
			},
			[PanasonicPTZActions.GetPanTiltPosition]: async (_id: PanasonicPTZActions.GetPanTiltPosition) => {
				return this.safelyExecuteActionCommand(() => new PanTiltPositionQuery())
			},
			[PanasonicPTZActions.StartZoom]: async (_id: PanasonicPTZActions.StartZoom, payload: StartZoomPayload) => {
				const speed = this.mapZoomSpeedToPanasonic(payload.zoomSpeed, payload.direction)
				return this.safelyExecuteActionCommand(() => new ZoomSpeedControl(speed))
			},
			[PanasonicPTZActions.StopZoom]: async (_id: PanasonicPTZActions.StopPanTilt) => {
				const speed = this.mapZoomSpeedToPanasonic(0)
				return this.safelyExecuteActionCommand(() => new ZoomSpeedControl(speed))
			},
			[PanasonicPTZActions.GetZoomPosition]: async (_id: PanasonicPTZActions.GetZoomPosition) => {
				return this.safelyExecuteActionCommand(() => new ZoomPositionQuery())
			},
			[PanasonicPTZActions.StartFocus]: async (_id: PanasonicPTZActions.StartFocus, payload: StartFocusPayload) => {
				const speed = this.mapFocusSpeedToPanasonic(payload.focusSpeed, payload.direction)
				return this.safelyExecuteActionCommand(() => new FocusSpeedControl(speed))
			},
			[PanasonicPTZActions.StopFocus]: async (_id: PanasonicPTZActions.StopFocus) => {
				const speed = this.mapFocusSpeedToPanasonic(0)
				return this.safelyExecuteActionCommand(() => new FocusSpeedControl(speed))
			},
			[PanasonicPTZActions.SetFocusMode]: async (
				_id: PanasonicPTZActions.SetFocusMode,
				payload: SetFocusModePayload
			) => {
				const mode = FOCUS_MODE_MAP[payload.mode]
				return this.safelyExecuteActionCommand(() => new AutoFocusOnOffControl(mode))
			},
			[PanasonicPTZActions.TriggerOnePushFocus]: async (_id: PanasonicPTZActions.TriggerOnePushFocus) => {
				return this.safelyExecuteActionCommand(() => new OneTouchFocusControl())
			},
			[PanasonicPTZActions.GetFocusPosition]: async (_id: PanasonicPTZActions.GetFocusPosition) => {
				return this.safelyExecuteActionCommand(() => new FocusPositionQuery())
			},
			[PanasonicPTZActions.GetFocusMode]: async (_id: PanasonicPTZActions.GetFocusMode) => {
				return this.safelyExecuteActionCommand(() => new AutoFocusOnOffQuery())
			},
		}

	private async safelyExecuteActionCommand(createCommandFun: () => Command): Promise<ActionExecutionResult> {
		try {
			const command = createCommandFun()
			await this._device?.executeCommand(command)
		} catch {
			return {
				result: ActionExecutionResultCode.Error,
			}
		}

		return {
			result: ActionExecutionResultCode.Ok,
		}
	}

	private mapPanTiltSpeedToPanasonic(panSpeed: number, tiltSpeed: number, direction?: PanTiltDirection) {
		panSpeed = Math.round((panSpeed / 100.0) * 49)
		tiltSpeed = Math.round((tiltSpeed / 100.0) * 49)
		if (
			direction === PanTiltDirection.DOWN_LEFT ||
			direction === PanTiltDirection.LEFT ||
			direction === PanTiltDirection.UP_LEFT
		) {
			panSpeed *= -1
		}
		panSpeed += 50
		if (
			direction === PanTiltDirection.DOWN ||
			direction === PanTiltDirection.DOWN_LEFT ||
			direction === PanTiltDirection.DOWN_RIGHT
		) {
			tiltSpeed *= -1
		}
		tiltSpeed += 50
		return {
			panSpeed,
			tiltSpeed,
		}
	}

	private mapZoomSpeedToPanasonic(speed: number, direction?: ZoomDirection) {
		speed = Math.round((speed / 100.0) * 49)
		if (direction === ZoomDirection.WIDE) {
			speed *= -1
		}
		speed += 50
		return speed
	}

	private mapFocusSpeedToPanasonic(speed: number, direction?: FocusDirection) {
		speed = Math.round((speed / 100.0) * 49)
		if (direction === FocusDirection.NEAR) {
			speed *= -1
		}
		speed += 50
		return speed
	}

	async executeAction(actionId: PanasonicPTZActions, payload?: Record<string, any>): Promise<ActionExecutionResult> {
		const actionFun = this.actions[actionId]

		if (actionFun) {
			return actionFun(actionId, payload)
		}

		return {
			result: ActionExecutionResultCode.Error,
			response: t('Device does not implement an action handler for this action ID'),
		}
	}

	/**
	 * Converts a timeline state into a device state.
	 * @param state
	 */
	convertStateToPtz(state: Timeline.TimelineState<TSRTimelineContent>, mappings: Mappings): PanasonicPtzState {
		// convert the timeline state into something we can use
		const ptzState: PanasonicPtzState = this._getDefaultState()

		_.each(state.layers, (tlObject, layerName: string) => {
			const mapping = mappings[layerName] as Mapping<SomeMappingPanasonicPTZ> | undefined
			if (
				mapping &&
				mapping.device === DeviceType.PANASONIC_PTZ &&
				mapping.deviceId === this.deviceId &&
				tlObject.content.deviceType === DeviceType.PANASONIC_PTZ
			) {
				if (
					mapping.options.mappingType === MappingPanasonicPTZType.PresetMem &&
					tlObject.content.type === TimelineContentTypePanasonicPtz.PRESET
				) {
					ptzState.preset = {
						value: tlObject.content.preset,
						timelineObjId: tlObject.id,
					}
				} else if (
					mapping.options.mappingType === MappingPanasonicPTZType.PresetSpeed &&
					tlObject.content.type === TimelineContentTypePanasonicPtz.SPEED
				) {
					ptzState.speed = {
						value: tlObject.content.speed,
						timelineObjId: tlObject.id,
					}
				} else if (
					mapping.options.mappingType === MappingPanasonicPTZType.ZoomSpeed &&
					tlObject.content.type === TimelineContentTypePanasonicPtz.ZOOM_SPEED
				) {
					ptzState.zoomSpeed = {
						value: tlObject.content.zoomSpeed,
						timelineObjId: tlObject.id,
					}
				} else if (
					mapping.options.mappingType === MappingPanasonicPTZType.Zoom &&
					tlObject.content.type === TimelineContentTypePanasonicPtz.ZOOM
				) {
					ptzState.zoom = {
						value: tlObject.content.zoom,
						timelineObjId: tlObject.id,
					}
				}
			}
		})

		return ptzState
	}
	/** Called by the Conductor a bit before a .handleState is called */
	prepareForHandleState(newStateTime: number) {
		// clear any queued commands later than this time:
		this._doOnTime.clearQueueNowAndAfter(newStateTime)
		this.cleanUpStates(0, newStateTime)
	}
	/**
	 * Handles a new state such that the device will be in that state at a specific point
	 * in time.
	 * @param newState
	 */
	handleState(newState: Timeline.TimelineState<TSRTimelineContent>, newMappings: Mappings) {
		super.onHandleState(newState, newMappings)
		// Create device states
		const previousStateTime = Math.max(this.getCurrentTime(), newState.time)
		const oldPtzState: PanasonicPtzState = (
			this.getStateBefore(previousStateTime) || { state: this._getDefaultState() }
		).state

		const newPtzState = this.convertStateToPtz(newState, newMappings)

		// Generate commands needed to reach new state
		const commandsToAchieveState: Array<PanasonicPtzCommandWithContext> = this._diffStates(oldPtzState, newPtzState)

		// clear any queued commands later than this time:
		this._doOnTime.clearQueueNowAndAfter(previousStateTime)
		// add the new commands to the queue:
		this._addToQueue(commandsToAchieveState, newState.time)

		// store the new state, for later use:
		this.setState(newPtzState, newState.time)
	}

	clearFuture(clearAfterTime: number) {
		// Clear any scheduled commands after this time
		this._doOnTime.clearQueueAfter(clearAfterTime)
	}
	async terminate() {
		if (this._pingInterval) clearInterval(this._pingInterval)
		if (this._device) {
			this._device.dispose()
		}
		return Promise.resolve(true)
	}
	getStatus(): DeviceStatus {
		let statusCode = StatusCode.GOOD
		const messages: Array<string> = []

		if (!this._connected) {
			statusCode = StatusCode.BAD
			messages.push('Not connected')
		}

		return {
			statusCode: statusCode,
			messages: messages,
			active: this.isActive,
		}
	}
	private _getDefaultState(): PanasonicPtzState {
		return {
			// preset: undefined,
			// speed: undefined,
			zoomSpeed: {
				value: 0,
				timelineObjId: 'default',
			},
			// zoom: undefined
		}
	}

	private async _defaultCommandReceiver(
		_time: number,
		cmd: PanasonicPtzCommand,
		context: CommandContext,
		timelineObjId: string
	): Promise<any> {
		const cwc: CommandWithContext = {
			context: context,
			command: cmd,
			timelineObjId: timelineObjId,
		}
		try {
			if (this._device) {
				let result: string | number
				if (cmd.type === TimelineContentTypePanasonicPtz.PRESET) {
					// recall preset
					if (cmd.preset !== undefined) {
						result = await this._device.executeCommand(new PresetPlaybackControl(cmd.preset))
					} else throw new Error(`Bad parameter: preset`)
				} else if (cmd.type === TimelineContentTypePanasonicPtz.SPEED) {
					// set speed
					if (cmd.speed !== undefined) {
						result = await this._device.executeCommand(new PresetSpeedControl(cmd.speed))
					} else throw new Error(`Bad parameter: speed`)
				} else if (cmd.type === TimelineContentTypePanasonicPtz.ZOOM_SPEED) {
					// set zoom speed
					if (cmd.zoomSpeed !== undefined) {
						// scale -1 - 0 - +1 range to 01 - 50 - 99 range
						result = await this._device.executeCommand(new ZoomSpeedControl(cmd.zoomSpeed * 49 + 50))
					} else throw new Error(`Bad parameter: zoomSpeed`)
				} else if (cmd.type === TimelineContentTypePanasonicPtz.ZOOM) {
					// set zoom
					if (cmd.zoom !== undefined) {
						// scale 0 - +1 range to 555h - FFFh range
						result = await this._device.executeCommand(new ZoomPositionControl(cmd.zoom * 0xaaa + 0x555))
					} else throw new Error(`Bad parameter: zoom`)
				} else throw new Error(`PTZ: Unknown type: "${cmd.type}"`)
				this.emitDebug(`Panasonic PTZ result: ${result}`)
			} else throw new Error(`PTZ device not set up`)
		} catch (e) {
			this.emit('commandError', e as Error, cwc)
		}
	}

	/**
	 * Add commands to queue, to be executed at the right time
	 */
	private _addToQueue(commandsToAchieveState: Array<PanasonicPtzCommandWithContext>, time: number) {
		const sortedCommandsToAchieveState = commandsToAchieveState.sort(
			(a, b) => COMMAND_PRIORITY[a.command.type] - COMMAND_PRIORITY[b.command.type]
		)

		_.each(sortedCommandsToAchieveState, (cmd: PanasonicPtzCommandWithContext) => {
			// add the new commands to the queue:
			this._doOnTime.queue(
				time,
				undefined,
				async (cmd: PanasonicPtzCommandWithContext) => {
					return this._commandReceiver(time, cmd.command, cmd.context, cmd.timelineObjId)
				},
				cmd
			)
		})
	}
	/**
	 * Compares the new timeline-state with the old one, and generates commands to account for the difference
	 */
	private _diffStates(
		oldPtzState: PanasonicPtzState,
		newPtzState: PanasonicPtzState
	): Array<PanasonicPtzCommandWithContext> {
		const commands: Array<PanasonicPtzCommandWithContext> = []

		const addCommands = (newNode: PanasonicPtzState, oldValue: PanasonicPtzState) => {
			if (
				newNode.preset &&
				this.getValue(newNode.preset) !== this.getValue(oldValue.preset) &&
				this.getValue(newNode.preset) !== undefined
			) {
				commands.push({
					command: {
						type: TimelineContentTypePanasonicPtz.PRESET,
						preset: this.getValue(newNode.preset),
					},
					context: `preset differ (${this.getValue(newNode.preset)}, ${this.getValue(oldValue.preset)})`,
					timelineObjId: newNode.preset.timelineObjId,
				})
			}
			if (
				newNode.speed &&
				this.getValue(newNode.speed) !== this.getValue(oldValue.speed) &&
				this.getValue(newNode.speed) !== undefined
			) {
				commands.push({
					command: {
						type: TimelineContentTypePanasonicPtz.SPEED,
						speed: this.getValue(newNode.speed),
					},
					context: `speed differ (${this.getValue(newNode.speed)}, ${this.getValue(oldValue.speed)})`,
					timelineObjId: newNode.speed.timelineObjId,
				})
			}
			if (
				newNode.zoomSpeed &&
				this.getValue(newNode.zoomSpeed) !== this.getValue(oldValue.zoomSpeed) &&
				this.getValue(newNode.zoomSpeed) !== undefined
			) {
				commands.push({
					command: {
						type: TimelineContentTypePanasonicPtz.ZOOM_SPEED,
						speed: this.getValue(newNode.zoomSpeed),
					},
					context: `zoom speed differ (${this.getValue(newNode.zoomSpeed)}, ${this.getValue(oldValue.zoomSpeed)})`,
					timelineObjId: newNode.zoomSpeed.timelineObjId,
				})
			}
			if (
				newNode.zoom &&
				this.getValue(newNode.zoom) !== this.getValue(oldValue.zoom) &&
				this.getValue(newNode.zoom) !== undefined
			) {
				commands.push({
					command: {
						type: TimelineContentTypePanasonicPtz.ZOOM,
						zoom: this.getValue(newNode.zoom),
					},
					context: `zoom differ (${this.getValue(newNode.zoom)}, ${this.getValue(oldValue.zoom)})`,
					timelineObjId: newNode.zoom.timelineObjId,
				})
			}
		}

		if (!_.isEqual(newPtzState, oldPtzState)) {
			addCommands(newPtzState, oldPtzState)
		}
		return commands
	}

	get canConnect(): boolean {
		return true
	}
	get connected(): boolean {
		return this._connected
	}
	get deviceType() {
		return DeviceType.PANASONIC_PTZ
	}
	get deviceName(): string {
		return 'Panasonic PTZ ' + this.deviceId
	}
	get queue() {
		return this._doOnTime.getQueue()
	}
	private _setConnected(connected: boolean) {
		if (this._connected !== connected) {
			this._connected = connected
			this._connectionChanged()
		}
	}
	private _connectionChanged() {
		this.emit('connectionChanged', this.getStatus())
	}
	private getValue<A extends { value: B }, B>(a?: A): B | undefined {
		if (a) return a.value
		return undefined
	}
}
