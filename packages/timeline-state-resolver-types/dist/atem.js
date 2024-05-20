"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaSourceType = exports.AtemTransitionStyle = exports.TimelineContentTypeAtem = void 0;
var TimelineContentTypeAtem;
(function (TimelineContentTypeAtem) {
    TimelineContentTypeAtem["ME"] = "me";
    TimelineContentTypeAtem["DSK"] = "dsk";
    TimelineContentTypeAtem["AUX"] = "aux";
    TimelineContentTypeAtem["SSRC"] = "ssrc";
    TimelineContentTypeAtem["SSRCPROPS"] = "ssrcProps";
    TimelineContentTypeAtem["MEDIAPLAYER"] = "mp";
    TimelineContentTypeAtem["AUDIOCHANNEL"] = "audioChan";
    TimelineContentTypeAtem["MACROPLAYER"] = "macroPlayer";
    TimelineContentTypeAtem["AUDIOROUTING"] = "audioRouting";
})(TimelineContentTypeAtem = exports.TimelineContentTypeAtem || (exports.TimelineContentTypeAtem = {}));
var AtemTransitionStyle;
(function (AtemTransitionStyle) {
    AtemTransitionStyle[AtemTransitionStyle["MIX"] = 0] = "MIX";
    AtemTransitionStyle[AtemTransitionStyle["DIP"] = 1] = "DIP";
    AtemTransitionStyle[AtemTransitionStyle["WIPE"] = 2] = "WIPE";
    AtemTransitionStyle[AtemTransitionStyle["DVE"] = 3] = "DVE";
    AtemTransitionStyle[AtemTransitionStyle["STING"] = 4] = "STING";
    AtemTransitionStyle[AtemTransitionStyle["CUT"] = 5] = "CUT";
    AtemTransitionStyle[AtemTransitionStyle["DUMMY"] = 6] = "DUMMY";
})(AtemTransitionStyle = exports.AtemTransitionStyle || (exports.AtemTransitionStyle = {}));
var MediaSourceType;
(function (MediaSourceType) {
    MediaSourceType[MediaSourceType["Still"] = 1] = "Still";
    MediaSourceType[MediaSourceType["Clip"] = 2] = "Clip";
})(MediaSourceType = exports.MediaSourceType || (exports.MediaSourceType = {}));
//# sourceMappingURL=atem.js.map