import {
	ActionExecutionResult,
	ActionExecutionResultCode,
	OpenPresetPayload,
	SavePresetPayload,
} from 'timeline-state-resolver-types'
import { t } from '../../lib'
import { VMixCommandSender } from './connection'

export class vMixActionsImpl {
	constructor(private getVMixCommandSender: () => VMixCommandSender) {}

	public async lastPreset(): Promise<ActionExecutionResult> {
		const presetActionCheckResult = this._checkPresetAction()
		if (presetActionCheckResult) return presetActionCheckResult
		await this.getVMixCommandSender().lastPreset()
		return {
			result: ActionExecutionResultCode.Ok,
		}
	}

	public async openPreset(_id: string, payload: OpenPresetPayload): Promise<ActionExecutionResult> {
		const presetActionCheckResult = this._checkPresetAction(payload, true)
		if (presetActionCheckResult) return presetActionCheckResult
		await this.getVMixCommandSender().openPreset(payload.filename)
		return {
			result: ActionExecutionResultCode.Ok,
		}
	}

	public async savePreset(_id: string, payload: SavePresetPayload): Promise<ActionExecutionResult> {
		const presetActionCheckResult = this._checkPresetAction(payload, true)
		if (presetActionCheckResult) return presetActionCheckResult
		await this.getVMixCommandSender().savePreset(payload.filename)
		return {
			result: ActionExecutionResultCode.Ok,
		}
	}

	public async startExternal() {
		const connectionError = this._checkConnectionForAction()
		if (connectionError) return connectionError

		await this.getVMixCommandSender().startExternal()
		return {
			result: ActionExecutionResultCode.Ok,
		}
	}

	public async stopExternal() {
		const connectionError = this._checkConnectionForAction()
		if (connectionError) return connectionError

		await this.getVMixCommandSender().stopExternal()
		return {
			result: ActionExecutionResultCode.Ok,
		}
	}

	private _checkPresetAction(payload?: any, payloadRequired?: boolean): ActionExecutionResult | undefined {
		const connectionError = this._checkConnectionForAction()
		if (connectionError) return connectionError

		if (payloadRequired) {
			if (!payload || typeof payload !== 'object') {
				return {
					result: ActionExecutionResultCode.Error,
					response: t('Action payload is invalid'),
				}
			}

			if (!payload.filename) {
				return {
					result: ActionExecutionResultCode.Error,
					response: t('No preset filename specified'),
				}
			}
		}
		return
	}

	private _checkConnectionForAction(): ActionExecutionResult | undefined {
		if (!this.getVMixCommandSender().connected) {
			return {
				result: ActionExecutionResultCode.Error,
				response: t('Cannot perform VMix action without a connection'),
			}
		}
		return undefined
	}
}
