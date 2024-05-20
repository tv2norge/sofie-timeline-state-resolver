export interface TriCasterSwitcherInfo {
    inputCount: number;
    meCount: number;
    dskCount: number;
    ddrCount: number;
}
export interface TriCasterProductInfo {
    productModel: string;
    sessionName: string;
    outputCount: number;
}
export declare class TriCasterInfoParser {
    parseSwitcherUpdate(switcherUpdateXml: string): TriCasterSwitcherInfo;
    parseProductInformation(productInformationXml: string): TriCasterProductInfo;
}
//# sourceMappingURL=triCasterInfoParser.d.ts.map