"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriCasterInfoParser = void 0;
const xml_js_1 = require("xml-js");
class TriCasterInfoParser {
    parseSwitcherUpdate(switcherUpdateXml) {
        const parsedSwitcher = (0, xml_js_1.xml2js)(switcherUpdateXml, { compact: true });
        const dskCount = (parsedSwitcher.switcher_update?.switcher_overlays?.overlay?.length ?? 5) - 1; // @todo why does the xml contain one more? probably it has something to do with previz or background
        const inputs = parsedSwitcher.switcher_update?.inputs;
        const inputCount = inputs?.physical_input?.filter((input) => /Input\d+/.test(input._attributes?.physical_input_number?.toString() ?? '')).length ?? 32;
        const meCount = inputs?.simulated_input?.filter((input) => /V\d+/.test(input._attributes?.simulated_input_number?.toString() ?? '')).length ?? 8;
        const ddrCount = inputs?.simulated_input?.filter((input) => /DDR\d+/.test(input._attributes?.simulated_input_number?.toString() ?? '')).length ?? 4;
        return {
            inputCount,
            dskCount,
            meCount,
            ddrCount,
        };
    }
    parseProductInformation(productInformationXml) {
        const parsedProduct = (0, xml_js_1.xml2js)(productInformationXml, { compact: true });
        return {
            productModel: parsedProduct.product_information?.product_model?._text ?? '',
            sessionName: parsedProduct.product_information?.session_name?._text ?? '',
            outputCount: Number(parsedProduct.product_information?.output_count?._text ?? 8),
        };
    }
}
exports.TriCasterInfoParser = TriCasterInfoParser;
//# sourceMappingURL=triCasterInfoParser.js.map