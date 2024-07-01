import * as _ from 'underscore'
import { EventEmitter } from 'events'
import got from 'got'
import * as querystring from 'querystring'
import { sprintf } from 'sprintf-js'

interface CommandQueueItem {
	command: string
	executing: boolean
	resolve: (response: string) => void
	reject: (error: any) => void
}
/**
 * Low level device class for Panasonic PTZ devices executing a
 * basic queue.
 */
export class PanasonicPtzCamera extends EventEmitter {
	private _url: string
	private _commandDelay: number
	private _commandQueue: Array<CommandQueueItem> = []
	private _executeQueueTimeout: Array<NodeJS.Timer> = []

	constructor(url: string, commandDelay = 130) {
		super()

		this._commandDelay = commandDelay
		this._url = url
	}

	async sendCommand(command: string): Promise<string> {
		const p: Promise<string> = new Promise((resolve, reject) => {
			this._commandQueue.push({ command: command, executing: false, resolve: resolve, reject: reject })
		})
		if (this._commandQueue.filter((i) => i.executing).length === 0) this._executeQueue()
		return p
	}
	dispose() {
		this._commandQueue = []
		_.each(this._executeQueueTimeout, (item) => {
			clearTimeout(item)
		})
	}

	private _dropFromQueue(item: CommandQueueItem) {
		const index = this._commandQueue.findIndex((i) => i === item)
		if (index >= 0) {
			this._commandQueue.splice(index, 1)
		} else {
			throw new Error(`Command ${item.command} should be dropped from the queue, but could not be found!`)
		}
	}

	private _executeQueue() {
		const qItem = this._commandQueue.find((i) => !i.executing)
		if (!qItem) {
			return
		}

		const queryUrl = this._url + '?' + querystring.stringify({ cmd: qItem.command, res: '1' })
		this.emit('debug', 'Command sent', queryUrl)

		qItem.executing = true
		got
			.get(queryUrl)
			.then((response) => {
				this._dropFromQueue(qItem)
				qItem.resolve(response.body)
			})
			.catch((error) => {
				this.emit('error', error)
				this._dropFromQueue(qItem)
				qItem.reject(error)
			})

		// find any commands that aren't executing yet and execute one after 130ms
		if (this._commandQueue.filter((i) => !i.executing).length > 0) {
			const timeout = setTimeout(() => {
				// remove from timeouts list
				const index = this._executeQueueTimeout.indexOf(timeout)
				if (index >= 0) {
					this._executeQueueTimeout.splice(index, 1)
				}

				this._executeQueue()
			}, this._commandDelay)
			// add to timeouts list so that we can cancel them when disposing
			this._executeQueueTimeout.push(timeout)
		}
	}
}
enum PanasonicHttpCommands {
	POWER_MODE_QUERY = '#O',

	PRESET_REGISTER_CONTROL_TPL = '#M%02i',
	PRESET_PLAYBACK_CONTROL_TPL = '#R%02i',
	PRESET_DELETE_CONTROL_TPL = '#C%02i',
	PRESET_NUMBER_QUERY = '#S',
	PRESET_SPEED_CONTROL_TPL = '#UPVS%03i',
	PRESET_SPEED_QUERY = '#UPVS',

	PAN_TILT_SPEED_CONTROL_TPL = '#PTS%02i%02i',

	ZOOM_SPEED_CONTROL_TPL = '#Z%02i',
	ZOOM_SPEED_QUERY = '#Z',
	ZOOM_CONTROL_TPL = '#AXZ%03X',
	ZOOM_QUERY = '#GZ',

	FOCUS_SPEED_CONTROL_TPL = '#F%02i',
	AUTO_FOCUS_ON_OFF_CONTROL_TPL = '#D1%d',
	ONE_TOUCH_FOCUS_CONTROL = 'OSE:69:1',
}
export enum PanasonicFocusMode {
	MANUAL = 0,
	AUTO = 1,
}
enum PanasonicHttpResponse {
	POWER_MODE_ON = 'p1',
	POWER_MODE_STBY = 'p0',
	POWER_MODE_TURNING_ON = 'p3',

	PRESET_NUMBER_TPL = 's',
	PRESET_SPEED_TPL = 'uPVS',

	PAN_TILT_SPEED_TPL = 'pTS',

	ZOOM_SPEED_TPL = 'zS',
	ZOOM_TPL = 'gz',
	ZOOM_CONTROL_TPL = 'axz',

	FOCUS_SPEED_TPL = 'fS',
	AUTO_FOCUS_ON_OFF_TPL = 'd1',
	ONE_TOUCH_FOCUS = 'OSE:69:1',

	ERROR_1 = 'E1',
	ERROR_2 = 'E2',
	ERROR_3 = 'E3',
}
/**
 * High level methods for interfacing with a panasonic PTZ camera. This class
 * depends on the PanasonicPtzCamera class.
 */
export class PanasonicPtzHttpInterface extends EventEmitter {
	private _device: PanasonicPtzCamera

	constructor(host: string, port?: number, https?: boolean) {
		super()

		this._device = new PanasonicPtzCamera(
			(https ? 'https' : 'http') + '://' + host + (port ? ':' + port : '') + '/cgi-bin/aw_ptz'
		)
		this._device.on('error', (err) => {
			this.emit('error', err)
		})
		this._device.on('debug', (...args) => {
			this.emit('debug', ...args)
		})
	}

	private static _isError(response: string) {
		if (
			response === PanasonicHttpResponse.ERROR_1 ||
			response === PanasonicHttpResponse.ERROR_2 ||
			response === PanasonicHttpResponse.ERROR_3
		) {
			return true
		} else {
			return false
		}
	}
	dispose() {
		this._device.dispose()
	}
	/**
	 * Get the last preset recalled in the camera
	 * @returns {Promise<number>}
	 * @memberof PanasonicPtzHttpInterface
	 */
	async getPreset(): Promise<number> {
		const device = this._device

		return new Promise((resolve, reject) => {
			device
				.sendCommand(PanasonicHttpCommands.PRESET_NUMBER_QUERY)
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.PRESET_NUMBER_TPL)) {
						const preset = Number.parseInt(response.substring(PanasonicHttpResponse.PRESET_NUMBER_TPL.length), 10)
						resolve(preset)
					} else {
						reject(`Unknown response to getPreset: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Recall camera preset
	 * @param {number} preset The preset to be recalled in the camera. 0-99
	 * @returns {Promise<number>} A promise: the preset the camera will transition to
	 * @memberof PanasonicPtzHttpInterface
	 */
	async recallPreset(preset: number): Promise<number> {
		const device = this._device

		this.validatePresetNumber(preset)

		return new Promise((resolve, reject) => {
			device
				.sendCommand(sprintf(PanasonicHttpCommands.PRESET_PLAYBACK_CONTROL_TPL, preset))
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.PRESET_NUMBER_TPL)) {
						const preset = Number.parseInt(response.substring(PanasonicHttpResponse.PRESET_NUMBER_TPL.length), 10)
						resolve(preset)
					} else {
						reject(`Unknown response to recallPreset: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Store camera preset
	 * @param {number} preset The preset to be stored in the camera. 0-99
	 * @returns {Promise<number>} A promise: the preset the camera will store to
	 * @memberof PanasonicPtzHttpInterface
	 */
	async storePreset(preset: number): Promise<number> {
		const device = this._device

		this.validatePresetNumber(preset)

		return new Promise((resolve, reject) => {
			device
				.sendCommand(sprintf(PanasonicHttpCommands.PRESET_REGISTER_CONTROL_TPL, preset))
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.PRESET_NUMBER_TPL)) {
						const preset = Number.parseInt(response.substring(PanasonicHttpResponse.PRESET_NUMBER_TPL.length), 10)
						resolve(preset)
					} else {
						reject(`Unknown response to storePreset: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Reset camera preset
	 * @param {number} preset The preset to be reset in the camera. 0-99
	 * @returns {Promise<number>} A promise: the preset the camera will reset
	 * @memberof PanasonicPtzHttpInterface
	 */
	async resetPreset(preset: number): Promise<number> {
		const device = this._device

		this.validatePresetNumber(preset)

		return new Promise((resolve, reject) => {
			device
				.sendCommand(sprintf(PanasonicHttpCommands.PRESET_DELETE_CONTROL_TPL, preset))
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.PRESET_NUMBER_TPL)) {
						const preset = Number.parseInt(response.substring(PanasonicHttpResponse.PRESET_NUMBER_TPL.length), 10)
						resolve(preset)
					} else {
						reject(`Unknown response to resetPreset: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	private validatePresetNumber(preset: number) {
		if (!_.isFinite(preset)) throw new Error('Camera speed preset is not a finite number')
		if (preset < 0 || preset > 99) throw new Error('Illegal preset number')
	}

	/**
	 * Get camera preset recall speed, within speed table
	 * @returns {Promise<number>} A promise: the speed set in the camera
	 * @memberof PanasonicPtzHttpInterface
	 */
	async getSpeed(): Promise<number> {
		const device = this._device

		return new Promise((resolve, reject) => {
			device
				.sendCommand(PanasonicHttpCommands.PRESET_SPEED_QUERY)
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.PRESET_SPEED_TPL)) {
						const speed = Number.parseInt(response.substring(PanasonicHttpResponse.PRESET_SPEED_TPL.length), 10)
						resolve(speed)
					} else {
						reject(`Unknown response to getSpeed: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Set camera preset recall speed, within speed table
	 * @param {number} speed Speed to be set for the camera preset recall. 250-999 or 0. 0 is maximum speed
	 * @returns {Promise<number>} A promise: the speed set in the camera
	 * @memberof PanasonicPtzHttpInterface
	 */
	async setSpeed(speed: number): Promise<number> {
		const device = this._device

		if (!_.isFinite(speed)) throw new Error('Camera speed preset is not a finite number')
		if ((speed < 250 || speed > 999) && speed !== 0)
			throw new Error('Camera speed must be between 250 and 999 or needs to be 0')

		return new Promise((resolve, reject) => {
			device
				.sendCommand(sprintf(PanasonicHttpCommands.PRESET_SPEED_CONTROL_TPL, speed))
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.PRESET_SPEED_TPL)) {
						const speed = Number.parseInt(response.substring(PanasonicHttpResponse.PRESET_SPEED_TPL.length), 10)
						resolve(speed)
					} else {
						reject(`Unknown response to setSpeed: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Get camera lens zoom speed (essentially, current virtual zoom rocker position)
	 * @returns {Promise<number>} A promise: the speed at which the lens is changing it's zoom
	 * @memberof PanasonicPtzHttpInterface
	 */
	async getZoomSpeed(): Promise<number> {
		const device = this._device

		return new Promise((resolve, reject) => {
			device
				.sendCommand(PanasonicHttpCommands.ZOOM_SPEED_QUERY)
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.ZOOM_SPEED_TPL)) {
						const speed = Number.parseInt(response.substring(PanasonicHttpResponse.ZOOM_SPEED_TPL.length), 10)
						resolve(speed)
					} else {
						reject(`Unknown response to getZoomSpeed: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Set camera lens zoom speed (essentially, current virtual zoom rocker position)
	 * @param {number} speed Speed to be set for the camera zoom. Acceptable values are 1-99. 50 is zoom stop, 49 is slowest WIDE, 51 is slowest TELE, 1 is fastest WIDE, 99 is fastest TELE
	 * @returns {Promise<number>} A promise: the speed at which the lens is changing its focus
	 * @memberof PanasonicPtzHttpInterface
	 */
	async setZoomSpeed(speed: number): Promise<number> {
		const device = this._device

		if (!_.isFinite(speed)) throw new Error('Camera zoom speed is not a finite number')
		if (speed < 1 || speed > 99) throw new Error('Camera zoom speed must be between 1 and 99')

		return new Promise((resolve, reject) => {
			device
				.sendCommand(sprintf(PanasonicHttpCommands.ZOOM_SPEED_CONTROL_TPL, speed))
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.ZOOM_SPEED_TPL)) {
						const speed = Number.parseInt(response.substring(PanasonicHttpResponse.ZOOM_SPEED_TPL.length), 10)
						resolve(speed)
					} else {
						reject(`Unknown response to setZoomSpeed: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Get camera lens zoom (an absolute number)
	 * @returns {Promise<number>} A promise: current lens zoom
	 * @memberof PanasonicPtzHttpInterface
	 */
	async getZoom(): Promise<number> {
		const device = this._device

		return new Promise((resolve, reject) => {
			device
				.sendCommand(PanasonicHttpCommands.ZOOM_QUERY)
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.ZOOM_TPL)) {
						const zoom = Number.parseInt(response.substring(PanasonicHttpResponse.ZOOM_TPL.length), 16)
						resolve(zoom)
					} else {
						reject(`Unknown response to getZoom: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Set camera lens zoom (an absolute number)
	 * @param {number} level The zoom level to set the lens to
	 * @returns {Promise<number>} A promise: current lens zoom
	 * @memberof PanasonicPtzHttpInterface
	 */
	async setZoom(level: number): Promise<number> {
		const device = this._device

		if (!_.isFinite(level)) throw new Error('Camera zoom speed is not a finite number')
		if (level < 0x555 || level > 0xfff) throw new Error('Camera zoom speed must be between 1365 and 4095')

		return new Promise((resolve, reject) => {
			device
				.sendCommand(sprintf(PanasonicHttpCommands.ZOOM_CONTROL_TPL, level))
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.ZOOM_CONTROL_TPL)) {
						const level = Number.parseInt(response.substring(PanasonicHttpResponse.ZOOM_CONTROL_TPL.length), 16)
						resolve(level)
					} else {
						reject(`Unknown response to setZoom: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Set camera focus speed
	 * @param {number} speed Speed to be set for the camera focus. Acceptable values are 1-99. 50 is focus stop, 49 is slowest NEAR, 51 is slowest FAR, 1 is fastest NEAR, 99 is fastest FAR
	 * @returns {Promise<number>} A promise: the speed at which the lens is changing its focus
	 * @memberof PanasonicPtzHttpInterface
	 */
	async setFocusSpeed(speed: number): Promise<number> {
		const device = this._device

		if (!_.isFinite(speed)) throw new Error('Camera focus speed is not a finite number')
		if (speed < 1 || speed > 99) throw new Error('Camera focus speed must be between 1 and 99')

		return new Promise((resolve, reject) => {
			device
				.sendCommand(sprintf(PanasonicHttpCommands.FOCUS_SPEED_CONTROL_TPL, speed))
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.FOCUS_SPEED_TPL)) {
						const speed = Number.parseInt(response.substring(PanasonicHttpResponse.FOCUS_SPEED_TPL.length), 10)
						resolve(speed)
					} else {
						reject(`Unknown response to setFocusSpeed: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Set camera focus mode (AUTO/MANUAL)
	 * @param {PanasonicFocusMode} mode Mode to be set for the camera focus
	 * @returns {Promise<PanasonicFocusMode>} A promise: the speed at which the lens is changing its focus
	 * @memberof PanasonicPtzHttpInterface
	 */
	async setFocusMode(mode: PanasonicFocusMode): Promise<PanasonicFocusMode> {
		const device = this._device

		return new Promise((resolve, reject) => {
			device
				.sendCommand(sprintf(PanasonicHttpCommands.AUTO_FOCUS_ON_OFF_CONTROL_TPL, mode))
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.AUTO_FOCUS_ON_OFF_TPL)) {
						const speed = Number.parseInt(response.substring(PanasonicHttpResponse.AUTO_FOCUS_ON_OFF_TPL.length), 10)
						resolve(speed)
					} else {
						reject(`Unknown response to setFocusMode: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Trigger one-touch focus
	 * @returns {Promise<void>}
	 * @memberof PanasonicPtzHttpInterface
	 */
	async triggerOneTouchFocus(): Promise<void> {
		const device = this._device

		return new Promise((resolve, reject) => {
			device
				.sendCommand(sprintf(PanasonicHttpCommands.ONE_TOUCH_FOCUS_CONTROL))
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.ONE_TOUCH_FOCUS)) {
						resolve()
					} else {
						reject(`Unknown response to triggerOneTouchFocus: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Set camera pan and tilt speed (essentially, current virtual joystick position)
	 * @param {number} speed Speed to be set for the camera zoom. Acceptable values are 1-99. 50 is pan stop, 49 is slowest LEFT, 51 is slowest RIGHT, 1 is fastest LEFT, 99 is fastest RIGHT
	 * @returns {Promise<number>} A promise: the speed at which the lens is changing its focus
	 * @memberof PanasonicPtzHttpInterface
	 */
	async setPanTiltSpeed(panSpeed: number, tiltSpeed: number): Promise<{ panSpeed: number; tiltSpeed: number }> {
		const device = this._device

		if (!_.isFinite(panSpeed)) throw new Error('Camera pan speed is not a finite number')
		if (panSpeed < 1 || panSpeed > 99) throw new Error('Camera pan speed must be between 1 and 99')
		if (!_.isFinite(tiltSpeed)) throw new Error('Camera tilt speed is not a finite number')
		if (tiltSpeed < 1 || tiltSpeed > 99) throw new Error('Camera tilt speed must be between 1 and 99')

		return new Promise((resolve, reject) => {
			device
				.sendCommand(sprintf(PanasonicHttpCommands.PAN_TILT_SPEED_CONTROL_TPL, panSpeed, tiltSpeed))
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response.startsWith(PanasonicHttpResponse.PAN_TILT_SPEED_TPL)) {
						const panTiltSpeed = response.substring(PanasonicHttpResponse.PAN_TILT_SPEED_TPL.length)
						const panSpeed = Number.parseInt(panTiltSpeed.substring(0, 2), 10)
						const tiltSpeed = Number.parseInt(panTiltSpeed.substring(2), 10)
						resolve({ panSpeed, tiltSpeed })
					} else {
						reject(`Unknown response to setPanTiltSpeed: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}

	/**
	 * Ping a camera by checking its power status. Will return true if the camera is on, false if it's off but reachable and will fail otherwise
	 * @returns {Promose<boolean | string>} A promise: true if the camera is ON, false if the camera is off, 'turningOn' if transitioning from STBY to ON
	 * @memberof PanasonicPtzHttpInterface
	 */
	async ping(): Promise<boolean | string> {
		const device = this._device
		return new Promise((resolve, reject) => {
			device
				.sendCommand(PanasonicHttpCommands.POWER_MODE_QUERY)
				.then((response) => {
					if (PanasonicPtzHttpInterface._isError(response)) {
						reject(`Device returned an error: ${response}`)
					} else if (response === PanasonicHttpResponse.POWER_MODE_ON) {
						resolve(true)
					} else if (response === PanasonicHttpResponse.POWER_MODE_STBY) {
						resolve(false)
					} else if (response === PanasonicHttpResponse.POWER_MODE_TURNING_ON) {
						resolve('turningOn')
					} else {
						reject(`Unknown response to ping: ${response}`)
					}
				})
				.catch((error) => {
					this.emit('disconnected', error)
					reject(error)
				})
		})
	}
}
