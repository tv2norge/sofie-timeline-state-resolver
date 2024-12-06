/* eslint-disable */
/**
 * This file was automatically generated by json-schema-to-typescript.
 * DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,
 * and run "yarn generate-schema-types" to regenerate this file.
 */

export interface VMixOptions {
	host: string
	port: number
	/**
	 * How often, in milliseconds, for when we should poll vMix to query its actual state. Used to know when to re-send certain failed commands. Values <= 0 disables the polling. Defaults to 10000ms.
	 */
	pollInterval?: number
}

export interface MappingVmixProgram {
	/**
	 * Number of the mix (1 is the main mix, 2-4 are optional Mix Inputs)
	 */
	index?: 1 | 2 | 3 | 4
	mappingType: MappingVmixType.Program
}

export interface MappingVmixPreview {
	/**
	 * Number of the mix (1 is the main mix, 2-4 are optional Mix Inputs)
	 */
	index?: 1 | 2 | 3 | 4
	mappingType: MappingVmixType.Preview
}

export interface MappingVmixInput {
	/**
	 * Input number or name. Omit if you plan to use the `filePath` property in `TimelineContentVMixInput`.
	 */
	index?: string
	mappingType: MappingVmixType.Input
}

export interface MappingVmixAudioChannel {
	/**
	 * Input number or name
	 */
	index?: string
	/**
	 * Input layer name
	 */
	inputLayer?: string
	mappingType: MappingVmixType.AudioChannel
}

export interface MappingVmixOutput {
	/**
	 * Output
	 */
	index: '2' | '3' | '4' | 'External2' | 'Fullscreen' | 'Fullscreen2'
	mappingType: MappingVmixType.Output
}

export interface MappingVmixOverlay {
	/**
	 * Overlay number
	 */
	index: 1 | 2 | 3 | 4
	mappingType: MappingVmixType.Overlay
}

export interface MappingVmixRecording {
	mappingType: MappingVmixType.Recording
}

export interface MappingVmixStreaming {
	mappingType: MappingVmixType.Streaming
}

export interface MappingVmixExternal {
	mappingType: MappingVmixType.External
}

export interface MappingVmixFadeToBlack {
	mappingType: MappingVmixType.FadeToBlack
}

export interface MappingVmixFader {
	mappingType: MappingVmixType.Fader
}

export interface MappingVmixScript {
	mappingType: MappingVmixType.Script
}

export enum MappingVmixType {
	Program = 'program',
	Preview = 'preview',
	Input = 'input',
	AudioChannel = 'audioChannel',
	Output = 'output',
	Overlay = 'overlay',
	Recording = 'recording',
	Streaming = 'streaming',
	External = 'external',
	FadeToBlack = 'fadeToBlack',
	Fader = 'fader',
	Script = 'script',
}

export type SomeMappingVmix = MappingVmixProgram | MappingVmixPreview | MappingVmixInput | MappingVmixAudioChannel | MappingVmixOutput | MappingVmixOverlay | MappingVmixRecording | MappingVmixStreaming | MappingVmixExternal | MappingVmixFadeToBlack | MappingVmixFader | MappingVmixScript

export interface OpenPresetPayload {
	/**
	 * The filename of the preset to load
	 */
	filename: string
}

export interface SavePresetPayload {
	/**
	 * The filename of the preset to save
	 */
	filename: string
}

export enum VmixActions {
	LastPreset = 'lastPreset',
	OpenPreset = 'openPreset',
	SavePreset = 'savePreset',
	StartExternal = 'StartExternal',
	StopExternal = 'StopExternal',
}
