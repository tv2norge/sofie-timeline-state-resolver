"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VMixStateDiffer = exports.TSR_INPUT_PREFIX = void 0;
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const vMixCommands_1 = require("./vMixCommands");
const _ = require("underscore");
const path = require("node:path");
/** Prefix of media input added by TSR. Only those with this prefix can be removed by this implementation */
exports.TSR_INPUT_PREFIX = 'TSR_MEDIA_';
class VMixStateDiffer {
    constructor(queueNow) {
        this.queueNow = queueNow;
    }
    getCommandsToAchieveState(oldVMixState, newVMixState) {
        let commands = [];
        const inputCommands = this._resolveInputsState(oldVMixState, newVMixState);
        commands = commands.concat(inputCommands.preTransitionCommands);
        commands = commands.concat(this._resolveMixState(oldVMixState, newVMixState));
        commands = commands.concat(this._resolveOverlaysState(oldVMixState, newVMixState));
        commands = commands.concat(inputCommands.postTransitionCommands);
        commands = commands.concat(this._resolveInputsAudioState(oldVMixState, newVMixState));
        commands = commands.concat(this._resolveRecordingState(oldVMixState.reportedState, newVMixState.reportedState));
        commands = commands.concat(this._resolveStreamingState(oldVMixState.reportedState, newVMixState.reportedState));
        commands = commands.concat(this._resolveExternalState(oldVMixState.reportedState, newVMixState.reportedState));
        commands = commands.concat(this._resolveOutputsState(oldVMixState, newVMixState));
        commands = commands.concat(this._resolveAddedByUsInputsRemovalState(oldVMixState.reportedState, newVMixState.reportedState));
        commands = commands.concat(this._resolveScriptsState(oldVMixState, newVMixState));
        return commands;
    }
    getDefaultState() {
        return {
            reportedState: {
                version: '',
                edition: '',
                existingInputs: {},
                existingInputsAudio: {},
                inputsAddedByUs: {},
                inputsAddedByUsAudio: {},
                overlays: [],
                mixes: [],
                fadeToBlack: false,
                faderPosition: 0,
                recording: undefined,
                external: undefined,
                streaming: undefined,
                playlist: false,
                multiCorder: false,
                fullscreen: false,
                audio: [],
            },
            outputs: {
                '2': undefined,
                '3': undefined,
                '4': undefined,
                External2: undefined,
                Fullscreen: undefined,
                Fullscreen2: undefined,
            },
            inputLayers: {},
            runningScripts: [],
        };
    }
    getDefaultInputState(inputNumber) {
        return {
            number: Number(inputNumber) || undefined,
            position: 0,
            loop: false,
            playing: false,
            transform: {
                zoom: 1,
                panX: 0,
                panY: 0,
                alpha: 255,
            },
            overlays: {},
        };
    }
    getDefaultInputAudioState(inputNumber) {
        return {
            number: Number(inputNumber) || undefined,
            muted: true,
            volume: 100,
            balance: 0,
            fade: 0,
            audioBuses: 'M',
            audioAuto: true,
        };
    }
    _resolveMixState(oldVMixState, newVMixState) {
        const commands = [];
        newVMixState.reportedState.mixes.forEach((_mix, i) => {
            /**
             * It is *not* guaranteed to have all mixes present in the vMix state because it's a sparse array.
             */
            const oldMixState = oldVMixState.reportedState.mixes[i];
            const newMixState = newVMixState.reportedState.mixes[i];
            if (newMixState?.program !== undefined) {
                let nextInput = newMixState.program;
                let changeOnLayer = false;
                if (newMixState.layerToProgram) {
                    nextInput = newVMixState.inputLayers[newMixState.program];
                    changeOnLayer =
                        newVMixState.inputLayers[newMixState.program] !== oldVMixState.inputLayers[newMixState.program];
                }
                if (oldMixState?.program !== newMixState.program || changeOnLayer) {
                    commands.push({
                        command: {
                            command: timeline_state_resolver_types_1.VMixCommand.TRANSITION,
                            effect: changeOnLayer ? timeline_state_resolver_types_1.VMixTransitionType.Cut : newMixState.transition.effect,
                            input: nextInput,
                            duration: changeOnLayer ? 0 : newMixState.transition.duration,
                            mix: i,
                        },
                        context: vMixCommands_1.CommandContext.None,
                        timelineId: '',
                    });
                }
            }
            if (oldMixState?.program === newMixState?.program && // if we're not switching what is on program, because it could break a transition
                newMixState?.preview !== undefined &&
                newMixState.preview !== oldMixState?.preview) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.PREVIEW_INPUT,
                        input: newMixState.preview,
                        mix: i,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
        });
        // Only set fader bar position if no other transitions are happening
        if (oldVMixState.reportedState.mixes[0]?.program === newVMixState.reportedState.mixes[0]?.program) {
            if (newVMixState.reportedState.faderPosition !== oldVMixState.reportedState.faderPosition) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.FADER,
                        value: newVMixState.reportedState.faderPosition || 0,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
                // newVMixState.reportedState.program = undefined
                // newVMixState.reportedState.preview = undefined
                newVMixState.reportedState.fadeToBlack = false;
            }
        }
        if (oldVMixState.reportedState.fadeToBlack !== newVMixState.reportedState.fadeToBlack) {
            // Danger: Fade to black is toggled, we can't explicitly say that we want it on or off
            commands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.FADE_TO_BLACK,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
        }
        return commands;
    }
    _resolveInputsState(oldVMixState, newVMixState) {
        const preTransitionCommands = [];
        const postTransitionCommands = [];
        _.map(newVMixState.reportedState.existingInputs, (input, key) => this._resolveExistingInputState(oldVMixState.reportedState.existingInputs[key], input, key, oldVMixState)).forEach((commands) => {
            preTransitionCommands.push(...commands.preTransitionCommands);
            postTransitionCommands.push(...commands.postTransitionCommands);
        });
        _.map(newVMixState.reportedState.inputsAddedByUs, (input, key) => this._resolveAddedByUsInputState(oldVMixState.reportedState.inputsAddedByUs[key], input, key, oldVMixState)).forEach((commands) => {
            preTransitionCommands.push(...commands.preTransitionCommands);
            postTransitionCommands.push(...commands.postTransitionCommands);
        });
        return { preTransitionCommands, postTransitionCommands };
    }
    _resolveExistingInputState(oldInput, input, key, oldVMixState) {
        oldInput ?? (oldInput = {}); // if we just started controlling it (e.g. due to mappings change), we don't know anything about the input
        return this._resolveInputState(oldVMixState, oldInput, input, key);
    }
    _resolveInputState(oldVMixState, oldInput, input, key) {
        if (input.name === undefined) {
            input.name = key;
        }
        const preTransitionCommands = [];
        const postTransitionCommands = [];
        /**
         * If an input is currently on air, then we delay changes to it until after the transition has began.
         * Note the word "began", instead of "completed".
         *
         * This mostly helps in the case of CUT transitions, where in theory everything happens
         * on the same frame but, in reality, thanks to how vMix processes API commands,
         * things take place over the course of a few frames.
         */
        const commands = this._isInUse(oldVMixState, oldInput) ? postTransitionCommands : preTransitionCommands;
        // It is important that the operations on listFilePaths happen before most other operations.
        // Consider the case where we want to change the contents of a List input AND set it to playing.
        // If we set it to playing first, it will automatically be forced to stop playing when
        // we dispatch LIST_REMOVE_ALL.
        // So, order of operations matters here.
        if (!_.isEqual(oldInput.listFilePaths, input.listFilePaths)) {
            // vMix has a quirk that we are working around here:
            // When a List input has no items, its Play/Pause button becomes inactive and
            // clicking it does nothing. However, if the List was playing when it was emptied,
            // it'll remain in a playing state. This means that as soon as new content is
            // added to the playlist, it will immediately begin playing. This feels like a
            // bug/mistake/otherwise unwanted behavior in every scenario. To work around this,
            // we automatically dispatch a PAUSE_INPUT command before emptying the playlist,
            // but only if there's no new content being added afterward.
            if (!input.listFilePaths || (Array.isArray(input.listFilePaths) && input.listFilePaths.length <= 0)) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.PAUSE_INPUT,
                        input: input.name,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
            commands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.LIST_REMOVE_ALL,
                    input: input.name,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
            if (Array.isArray(input.listFilePaths)) {
                for (const filePath of input.listFilePaths) {
                    commands.push({
                        command: {
                            command: timeline_state_resolver_types_1.VMixCommand.LIST_ADD,
                            input: input.name,
                            value: filePath,
                        },
                        context: vMixCommands_1.CommandContext.None,
                        timelineId: '',
                    });
                }
            }
        }
        if (input.playing !== undefined && oldInput.playing !== input.playing && !input.playing) {
            commands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.PAUSE_INPUT,
                    input: input.name,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
        }
        if (oldInput.position !== input.position) {
            commands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.SET_POSITION,
                    input: key,
                    value: input.position ? input.position : 0,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
        }
        if (input.restart !== undefined && oldInput.restart !== input.restart && input.restart) {
            commands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.RESTART_INPUT,
                    input: key,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
        }
        if (input.loop !== undefined && oldInput.loop !== input.loop) {
            if (input.loop) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.LOOP_ON,
                        input: input.name,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
            else {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.LOOP_OFF,
                        input: input.name,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
        }
        if (input.transform !== undefined && !_.isEqual(oldInput.transform, input.transform)) {
            if (oldInput.transform === undefined || input.transform.zoom !== oldInput.transform.zoom) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.SET_ZOOM,
                        input: key,
                        value: input.transform.zoom,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
            if (oldInput.transform === undefined || input.transform.alpha !== oldInput.transform.alpha) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.SET_ALPHA,
                        input: key,
                        value: input.transform.alpha,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
            if (oldInput.transform === undefined || input.transform.panX !== oldInput.transform.panX) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.SET_PAN_X,
                        input: key,
                        value: input.transform.panX,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
            if (oldInput.transform === undefined || input.transform.panY !== oldInput.transform.panY) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.SET_PAN_Y,
                        input: key,
                        value: input.transform.panY,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
        }
        if (input.overlays !== undefined && !_.isEqual(oldInput.overlays, input.overlays)) {
            for (const index of Object.keys(input.overlays)) {
                if (oldInput.overlays === undefined || input.overlays[index] !== oldInput.overlays?.[index]) {
                    commands.push({
                        command: {
                            command: timeline_state_resolver_types_1.VMixCommand.SET_INPUT_OVERLAY,
                            input: key,
                            value: input.overlays[Number(index)],
                            index: Number(index),
                        },
                        context: vMixCommands_1.CommandContext.None,
                        timelineId: '',
                    });
                }
            }
            for (const index of Object.keys(oldInput.overlays ?? {})) {
                if (!input.overlays?.[index]) {
                    commands.push({
                        command: {
                            command: timeline_state_resolver_types_1.VMixCommand.SET_INPUT_OVERLAY,
                            input: key,
                            value: '',
                            index: Number(index),
                        },
                        context: vMixCommands_1.CommandContext.None,
                        timelineId: '',
                    });
                }
            }
        }
        if (input.playing !== undefined && oldInput.playing !== input.playing && input.playing) {
            commands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.PLAY_INPUT,
                    input: input.name,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
        }
        return { preTransitionCommands, postTransitionCommands };
    }
    _resolveInputsAudioState(oldVMixState, newVMixState) {
        const commands = [];
        for (const [key, input] of Object.entries(newVMixState.reportedState.existingInputsAudio)) {
            this._resolveInputAudioState(oldVMixState.reportedState.existingInputsAudio[key] ?? {}, // if we just started controlling it (e.g. due to mappings change), we don't know anything about the input
            input, commands, key);
        }
        for (const [key, input] of Object.entries(newVMixState.reportedState.inputsAddedByUsAudio)) {
            this._resolveInputAudioState(oldVMixState.reportedState.inputsAddedByUsAudio[key] ?? this.getDefaultInputAudioState(key), // we assume that a new input has all parameters default
            input, commands, key);
        }
        return commands;
    }
    _resolveInputAudioState(oldInput, input, commands, key) {
        if (input.muted !== undefined && oldInput.muted !== input.muted && input.muted) {
            commands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.AUDIO_OFF,
                    input: key,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
        }
        if (oldInput.volume !== input.volume && input.volume !== undefined) {
            commands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.AUDIO_VOLUME,
                    input: key,
                    value: input.volume,
                    fade: input.fade,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
        }
        if (oldInput.balance !== input.balance && input.balance !== undefined) {
            commands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.AUDIO_BALANCE,
                    input: key,
                    value: input.balance,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
        }
        if (input.audioAuto !== undefined && oldInput.audioAuto !== input.audioAuto) {
            if (!input.audioAuto) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.AUDIO_AUTO_OFF,
                        input: key,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
            else {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.AUDIO_AUTO_ON,
                        input: key,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
        }
        if (input.audioBuses !== undefined && oldInput.audioBuses !== input.audioBuses) {
            const oldBuses = (oldInput.audioBuses || 'M,A,B,C,D,E,F,G').split(',').filter((x) => x);
            const newBuses = input.audioBuses.split(',').filter((x) => x);
            _.difference(newBuses, oldBuses).forEach((bus) => {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.AUDIO_BUS_ON,
                        input: key,
                        value: bus,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            });
            _.difference(oldBuses, newBuses).forEach((bus) => {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.AUDIO_BUS_OFF,
                        input: key,
                        value: bus,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            });
        }
        if (input.muted !== undefined && oldInput.muted !== input.muted && !input.muted) {
            commands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.AUDIO_ON,
                    input: key,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
        }
    }
    _resolveAddedByUsInputState(oldInput, input, key, oldVMixState) {
        if (input.name === undefined) {
            input.name = key;
        }
        const actualName = key.substring(exports.TSR_INPUT_PREFIX.length);
        if (oldInput == null && input.type !== undefined) {
            const addCommands = [];
            addCommands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.ADD_INPUT,
                    value: `${input.type}|${actualName}`,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
            addCommands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.SET_INPUT_NAME,
                    input: this._getFilename(actualName),
                    value: key,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
            this.queueNow(addCommands);
        }
        oldInput ?? (oldInput = this.getDefaultInputState(0)); // or {} but we assume that a new input has all parameters default
        return this._resolveInputState(oldVMixState, oldInput, input, key);
    }
    _resolveAddedByUsInputsRemovalState(oldVMixState, newVMixState) {
        const commands = [];
        _.difference(Object.keys(oldVMixState.inputsAddedByUs), Object.keys(newVMixState.inputsAddedByUs)).forEach((input) => {
            // TODO: either schedule this command for later or make the timeline object long enough to prevent removing while transitioning
            commands.push({
                command: {
                    command: timeline_state_resolver_types_1.VMixCommand.REMOVE_INPUT,
                    input: oldVMixState.inputsAddedByUs[input].name || input,
                },
                context: vMixCommands_1.CommandContext.None,
                timelineId: '',
            });
        });
        return commands;
    }
    _resolveOverlaysState(oldVMixState, newVMixState) {
        const commands = [];
        newVMixState.reportedState.overlays.forEach((overlay, index) => {
            const oldOverlay = oldVMixState.reportedState.overlays[index];
            if (overlay != null && (oldOverlay == null || oldOverlay?.input !== overlay.input)) {
                if (overlay.input === undefined) {
                    commands.push({
                        command: {
                            command: timeline_state_resolver_types_1.VMixCommand.OVERLAY_INPUT_OUT,
                            value: overlay.number,
                        },
                        context: vMixCommands_1.CommandContext.None,
                        timelineId: '',
                    });
                }
                else {
                    commands.push({
                        command: {
                            command: timeline_state_resolver_types_1.VMixCommand.OVERLAY_INPUT_IN,
                            input: overlay.input,
                            value: overlay.number,
                        },
                        context: vMixCommands_1.CommandContext.None,
                        timelineId: '',
                    });
                }
            }
        });
        return commands;
    }
    _resolveRecordingState(oldVMixState, newVMixState) {
        const commands = [];
        if (newVMixState.recording != null && oldVMixState.recording !== newVMixState.recording) {
            if (newVMixState.recording) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.START_RECORDING,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
            else {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.STOP_RECORDING,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
        }
        return commands;
    }
    _resolveStreamingState(oldVMixState, newVMixState) {
        const commands = [];
        if (newVMixState.streaming != null && oldVMixState.streaming !== newVMixState.streaming) {
            if (newVMixState.streaming) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.START_STREAMING,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
            else {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.STOP_STREAMING,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
        }
        return commands;
    }
    _resolveExternalState(oldVMixState, newVMixState) {
        const commands = [];
        if (newVMixState.external != null && oldVMixState.external !== newVMixState.external) {
            if (newVMixState.external) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.START_EXTERNAL,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
            else {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.STOP_EXTERNAL,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
        }
        return commands;
    }
    _resolveOutputsState(oldVMixState, newVMixState) {
        const commands = [];
        for (const [name, output] of Object.entries({ ...newVMixState.outputs })) {
            const nameKey = name;
            const oldOutput = nameKey in oldVMixState.outputs ? oldVMixState.outputs[nameKey] : undefined;
            if (output != null && !_.isEqual(output, oldOutput)) {
                const value = output.source === 'Program' ? 'Output' : output.source;
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.SET_OUPUT,
                        value,
                        input: output.input,
                        name,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
        }
        return commands;
    }
    _resolveScriptsState(oldVMixState, newVMixState) {
        const commands = [];
        _.map(newVMixState.runningScripts, (name) => {
            const alreadyRunning = oldVMixState.runningScripts.includes(name);
            if (!alreadyRunning) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.SCRIPT_START,
                        value: name,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
        });
        _.map(oldVMixState.runningScripts, (name) => {
            const noLongerDesired = !newVMixState.runningScripts.includes(name);
            if (noLongerDesired) {
                commands.push({
                    command: {
                        command: timeline_state_resolver_types_1.VMixCommand.SCRIPT_STOP,
                        value: name,
                    },
                    context: vMixCommands_1.CommandContext.None,
                    timelineId: '',
                });
            }
        });
        return commands;
    }
    /**
     * Checks if TSR thinks an input is currently in-use.
     * Not guaranteed to align with reality.
     */
    _isInUse(state, input) {
        for (const mix of state.reportedState.mixes) {
            if (mix == null)
                continue;
            if (mix.program === input.number || mix.program === input.name) {
                // The input is in program in some mix, so stop the search and return true.
                return true;
            }
            if (typeof mix.program === 'undefined')
                continue;
            const pgmInput = state.reportedState.existingInputs[mix.program] ??
                state.reportedState.inputsAddedByUs[mix.program];
            if (!pgmInput || !pgmInput.overlays)
                continue;
            for (const layer of Object.keys(pgmInput.overlays)) {
                const layerInput = pgmInput.overlays[layer];
                if (layerInput === input.name || layerInput === input.number) {
                    // Input is in program as a layer of a Multi View of something else that is in program,
                    // so stop the search and return true.
                    return true;
                }
            }
        }
        for (const overlay of state.reportedState.overlays) {
            if (overlay == null)
                continue;
            if (overlay.input === input.name || overlay.input === input.number) {
                // Input is in program as an overlay (DSK),
                // so stop the search and return true.
                return true;
            }
        }
        for (const output of Object.values({ ...state.outputs })) {
            if (output == null)
                continue;
            if (output.input === input.name || output.input === input.number) {
                // Input might not technically be in PGM, but it's being used by an output,
                // so stop the search and return true.
                return true;
            }
        }
        return false;
    }
    _getFilename(filePath) {
        return path.basename(filePath);
    }
}
exports.VMixStateDiffer = VMixStateDiffer;
//# sourceMappingURL=vMixStateDiffer.js.map