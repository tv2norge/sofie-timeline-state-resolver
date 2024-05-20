"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manifest = void 0;
const timeline_state_resolver_types_1 = require("timeline-state-resolver-types");
const AbstractActions = require("./integrations/abstract/$schemas/actions.json");
const AbstractOptions = require("./integrations/abstract/$schemas/options.json");
const AbstractMappings = require("./integrations/abstract/$schemas/mappings.json");
const AtemActions = require("./integrations/atem/$schemas/actions.json");
const AtemOptions = require("./integrations/atem/$schemas/options.json");
const AtemMappings = require("./integrations/atem/$schemas/mappings.json");
const CasparCGActions = require("./integrations/casparCG/$schemas/actions.json");
const CasparCGOptions = require("./integrations/casparCG/$schemas/options.json");
const CasparCGMappings = require("./integrations/casparCG/$schemas/mappings.json");
const HTTPSendOptions = require("./integrations/httpSend/$schemas/options.json");
const HTTPSendMappings = require("./integrations/httpSend/$schemas/mappings.json");
const HTTPWatcherOptions = require("./integrations/httpWatcher/$schemas/options.json");
const HTTPWatcherMappings = require("./integrations/httpWatcher/$schemas/mappings.json");
const HyperdeckActions = require("./integrations/hyperdeck/$schemas/actions.json");
const HyperdeckOptions = require("./integrations/hyperdeck/$schemas/options.json");
const HyperdeckMappings = require("./integrations/hyperdeck/$schemas/mappings.json");
const LawoOptions = require("./integrations/lawo/$schemas/options.json");
const LawoMappings = require("./integrations/lawo/$schemas/mappings.json");
const MultiOSCOptions = require("./integrations/multiOsc/$schemas/options.json");
const MultiOSCMappings = require("./integrations/multiOsc/$schemas/mappings.json");
const OBSOptions = require("./integrations/obs/$schemas/options.json");
const OBSMappings = require("./integrations/obs/$schemas/mappings.json");
const OSCOptions = require("./integrations/osc/$schemas/options.json");
const OSCMappings = require("./integrations/osc/$schemas/mappings.json");
const PanasonicPTZOptions = require("./integrations/panasonicPTZ/$schemas/options.json");
const PanasonicPTZMappings = require("./integrations/panasonicPTZ/$schemas/mappings.json");
const PharosOptions = require("./integrations/pharos/$schemas/options.json");
const PharosMappings = require("./integrations/pharos/$schemas/mappings.json");
const QuantelActions = require("./integrations/quantel/$schemas/actions.json");
const QuantelOptions = require("./integrations/quantel/$schemas/options.json");
const QuantelMappings = require("./integrations/quantel/$schemas/mappings.json");
const ShotokuOptions = require("./integrations/shotoku/$schemas/options.json");
const ShotokuMappings = require("./integrations/shotoku/$schemas/mappings.json");
const SingularLiveOptions = require("./integrations/singularLive/$schemas/options.json");
const SingularLiveMappings = require("./integrations/singularLive/$schemas/mappings.json");
const SisyfosOptions = require("./integrations/sisyfos/$schemas/options.json");
const SisyfosMappings = require("./integrations/sisyfos/$schemas/mappings.json");
const SofieChefOptions = require("./integrations/sofieChef/$schemas/options.json");
const SofieChefMappings = require("./integrations/sofieChef/$schemas/mappings.json");
const TCPSendOptions = require("./integrations/tcpSend/$schemas/options.json");
const TCPSendMappings = require("./integrations/tcpSend/$schemas/mappings.json");
const TelemetricsOptions = require("./integrations/telemetrics/$schemas/options.json");
const TelemetricsMappings = require("./integrations/telemetrics/$schemas/mappings.json");
const TricasterOptions = require("./integrations/tricaster/$schemas/options.json");
const TricasterMappings = require("./integrations/tricaster/$schemas/mappings.json");
const HttpSendActions = require("./integrations/httpSend/$schemas/actions.json");
const PharosActions = require("./integrations/pharos/$schemas/actions.json");
const TcpSendActions = require("./integrations/tcpSend/$schemas/actions.json");
const VizMSEActions = require("./integrations/vizMSE/$schemas/actions.json");
const VizMSEOptions = require("./integrations/vizMSE/$schemas/options.json");
const VizMSEMappings = require("./integrations/vizMSE/$schemas/mappings.json");
const VMixOptions = require("./integrations/vmix/$schemas/options.json");
const VMixMappings = require("./integrations/vmix/$schemas/mappings.json");
const VMixActions = require("./integrations/vmix/$schemas/actions.json");
const CommonOptions = require("./$schemas/common-options.json");
const lib_1 = require("./lib");
const stringifyActionSchema = (action) => ({
    ...action,
    payload: JSON.stringify(action.payload),
});
const stringifyMappingSchema = (schema) => Object.fromEntries(Object.entries(schema.mappings).map(([id, sch]) => [id, JSON.stringify(sch)]));
exports.manifest = {
    commonOptions: JSON.stringify(CommonOptions),
    subdevices: {
        [timeline_state_resolver_types_1.DeviceType.ABSTRACT]: {
            displayName: (0, lib_1.generateTranslation)('Abstract'),
            actions: AbstractActions.actions.map(stringifyActionSchema),
            configSchema: JSON.stringify(AbstractOptions),
            mappingsSchemas: stringifyMappingSchema(AbstractMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.ATEM]: {
            displayName: (0, lib_1.generateTranslation)('Blackmagic ATEM'),
            actions: AtemActions.actions.map(stringifyActionSchema),
            configSchema: JSON.stringify(AtemOptions),
            mappingsSchemas: stringifyMappingSchema(AtemMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.CASPARCG]: {
            displayName: (0, lib_1.generateTranslation)('CasparCG'),
            actions: CasparCGActions.actions.map(stringifyActionSchema),
            configSchema: JSON.stringify(CasparCGOptions),
            mappingsSchemas: stringifyMappingSchema(CasparCGMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.HTTPSEND]: {
            displayName: (0, lib_1.generateTranslation)('HTTP Send'),
            actions: HttpSendActions.actions.map(stringifyActionSchema),
            configSchema: JSON.stringify(HTTPSendOptions),
            mappingsSchemas: stringifyMappingSchema(HTTPSendMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.HTTPWATCHER]: {
            displayName: (0, lib_1.generateTranslation)('HTTP Watcher'),
            configSchema: JSON.stringify(HTTPWatcherOptions),
            mappingsSchemas: stringifyMappingSchema(HTTPWatcherMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.HYPERDECK]: {
            displayName: (0, lib_1.generateTranslation)('Blackmagic Hyperdeck'),
            actions: HyperdeckActions.actions.map(stringifyActionSchema),
            configSchema: JSON.stringify(HyperdeckOptions),
            mappingsSchemas: stringifyMappingSchema(HyperdeckMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.LAWO]: {
            displayName: (0, lib_1.generateTranslation)('Lawo'),
            configSchema: JSON.stringify(LawoOptions),
            mappingsSchemas: stringifyMappingSchema(LawoMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.MULTI_OSC]: {
            displayName: (0, lib_1.generateTranslation)('Multi OSC'),
            configSchema: JSON.stringify(MultiOSCOptions),
            mappingsSchemas: stringifyMappingSchema(MultiOSCMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.OBS]: {
            displayName: (0, lib_1.generateTranslation)('OBS Studio'),
            configSchema: JSON.stringify(OBSOptions),
            mappingsSchemas: stringifyMappingSchema(OBSMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.OSC]: {
            displayName: (0, lib_1.generateTranslation)('OSC'),
            configSchema: JSON.stringify(OSCOptions),
            mappingsSchemas: stringifyMappingSchema(OSCMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.PANASONIC_PTZ]: {
            displayName: (0, lib_1.generateTranslation)('Panasonic PTZ'),
            configSchema: JSON.stringify(PanasonicPTZOptions),
            mappingsSchemas: stringifyMappingSchema(PanasonicPTZMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.PHAROS]: {
            displayName: (0, lib_1.generateTranslation)('Pharos'),
            actions: PharosActions.actions.map(stringifyActionSchema),
            configSchema: JSON.stringify(PharosOptions),
            mappingsSchemas: stringifyMappingSchema(PharosMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.QUANTEL]: {
            displayName: (0, lib_1.generateTranslation)('Quantel'),
            actions: QuantelActions.actions.map(stringifyActionSchema),
            configSchema: JSON.stringify(QuantelOptions),
            mappingsSchemas: stringifyMappingSchema(QuantelMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.SHOTOKU]: {
            displayName: (0, lib_1.generateTranslation)('Shotoku'),
            configSchema: JSON.stringify(ShotokuOptions),
            mappingsSchemas: stringifyMappingSchema(ShotokuMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.SINGULAR_LIVE]: {
            displayName: (0, lib_1.generateTranslation)('Singular Live'),
            configSchema: JSON.stringify(SingularLiveOptions),
            mappingsSchemas: stringifyMappingSchema(SingularLiveMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.SISYFOS]: {
            displayName: (0, lib_1.generateTranslation)('Sisyfos'),
            configSchema: JSON.stringify(SisyfosOptions),
            mappingsSchemas: stringifyMappingSchema(SisyfosMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.SOFIE_CHEF]: {
            displayName: (0, lib_1.generateTranslation)('Sofie Chef'),
            configSchema: JSON.stringify(SofieChefOptions),
            mappingsSchemas: stringifyMappingSchema(SofieChefMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.TCPSEND]: {
            displayName: (0, lib_1.generateTranslation)('TCP Send'),
            actions: TcpSendActions.actions.map(stringifyActionSchema),
            configSchema: JSON.stringify(TCPSendOptions),
            mappingsSchemas: stringifyMappingSchema(TCPSendMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.TELEMETRICS]: {
            displayName: (0, lib_1.generateTranslation)('Telemetrics'),
            configSchema: JSON.stringify(TelemetricsOptions),
            mappingsSchemas: stringifyMappingSchema(TelemetricsMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.TRICASTER]: {
            displayName: (0, lib_1.generateTranslation)('Tricaster'),
            configSchema: JSON.stringify(TricasterOptions),
            mappingsSchemas: stringifyMappingSchema(TricasterMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.VIZMSE]: {
            displayName: (0, lib_1.generateTranslation)('Viz MSE'),
            actions: VizMSEActions.actions.map(stringifyActionSchema),
            configSchema: JSON.stringify(VizMSEOptions),
            mappingsSchemas: stringifyMappingSchema(VizMSEMappings),
        },
        [timeline_state_resolver_types_1.DeviceType.VMIX]: {
            displayName: (0, lib_1.generateTranslation)('VMix'),
            actions: VMixActions.actions.map(stringifyActionSchema),
            configSchema: JSON.stringify(VMixOptions),
            mappingsSchemas: stringifyMappingSchema(VMixMappings),
        },
    },
};
//# sourceMappingURL=manifest.js.map