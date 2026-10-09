/**
 * @public
 * @enum
 */
export declare const FeatureType: {
    readonly FORMS: "FORMS";
    readonly LAYOUT: "LAYOUT";
    readonly QUERIES: "QUERIES";
    readonly SIGNATURES: "SIGNATURES";
    readonly TABLES: "TABLES";
};
/**
 * @public
 */
export type FeatureType = (typeof FeatureType)[keyof typeof FeatureType];
/**
 * @public
 * @enum
 */
export declare const AdapterVersionStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly AT_RISK: "AT_RISK";
    readonly CREATION_ERROR: "CREATION_ERROR";
    readonly CREATION_IN_PROGRESS: "CREATION_IN_PROGRESS";
    readonly DEPRECATED: "DEPRECATED";
};
/**
 * @public
 */
export type AdapterVersionStatus = (typeof AdapterVersionStatus)[keyof typeof AdapterVersionStatus];
/**
 * @public
 * @enum
 */
export declare const ContentClassifier: {
    readonly FREE_OF_ADULT_CONTENT: "FreeOfAdultContent";
    readonly FREE_OF_PERSONALLY_IDENTIFIABLE_INFORMATION: "FreeOfPersonallyIdentifiableInformation";
};
/**
 * @public
 */
export type ContentClassifier = (typeof ContentClassifier)[keyof typeof ContentClassifier];
/**
 * @public
 * @enum
 */
export declare const BlockType: {
    readonly CELL: "CELL";
    readonly KEY_VALUE_SET: "KEY_VALUE_SET";
    readonly LAYOUT_FIGURE: "LAYOUT_FIGURE";
    readonly LAYOUT_FOOTER: "LAYOUT_FOOTER";
    readonly LAYOUT_HEADER: "LAYOUT_HEADER";
    readonly LAYOUT_KEY_VALUE: "LAYOUT_KEY_VALUE";
    readonly LAYOUT_LIST: "LAYOUT_LIST";
    readonly LAYOUT_PAGE_NUMBER: "LAYOUT_PAGE_NUMBER";
    readonly LAYOUT_SECTION_HEADER: "LAYOUT_SECTION_HEADER";
    readonly LAYOUT_TABLE: "LAYOUT_TABLE";
    readonly LAYOUT_TEXT: "LAYOUT_TEXT";
    readonly LAYOUT_TITLE: "LAYOUT_TITLE";
    readonly LINE: "LINE";
    readonly MERGED_CELL: "MERGED_CELL";
    readonly PAGE: "PAGE";
    readonly QUERY: "QUERY";
    readonly QUERY_RESULT: "QUERY_RESULT";
    readonly SELECTION_ELEMENT: "SELECTION_ELEMENT";
    readonly SIGNATURE: "SIGNATURE";
    readonly TABLE: "TABLE";
    readonly TABLE_FOOTER: "TABLE_FOOTER";
    readonly TABLE_TITLE: "TABLE_TITLE";
    readonly TITLE: "TITLE";
    readonly WORD: "WORD";
};
/**
 * @public
 */
export type BlockType = (typeof BlockType)[keyof typeof BlockType];
/**
 * @public
 * @enum
 */
export declare const EntityType: {
    readonly COLUMN_HEADER: "COLUMN_HEADER";
    readonly KEY: "KEY";
    readonly SEMI_STRUCTURED_TABLE: "SEMI_STRUCTURED_TABLE";
    readonly STRUCTURED_TABLE: "STRUCTURED_TABLE";
    readonly TABLE_FOOTER: "TABLE_FOOTER";
    readonly TABLE_SECTION_TITLE: "TABLE_SECTION_TITLE";
    readonly TABLE_SUMMARY: "TABLE_SUMMARY";
    readonly TABLE_TITLE: "TABLE_TITLE";
    readonly VALUE: "VALUE";
};
/**
 * @public
 */
export type EntityType = (typeof EntityType)[keyof typeof EntityType];
/**
 * @public
 * @enum
 */
export declare const RelationshipType: {
    readonly ANSWER: "ANSWER";
    readonly CHILD: "CHILD";
    readonly COMPLEX_FEATURES: "COMPLEX_FEATURES";
    readonly MERGED_CELL: "MERGED_CELL";
    readonly TABLE: "TABLE";
    readonly TABLE_FOOTER: "TABLE_FOOTER";
    readonly TABLE_TITLE: "TABLE_TITLE";
    readonly TITLE: "TITLE";
    readonly VALUE: "VALUE";
};
/**
 * @public
 */
export type RelationshipType = (typeof RelationshipType)[keyof typeof RelationshipType];
/**
 * @public
 * @enum
 */
export declare const SelectionStatus: {
    readonly NOT_SELECTED: "NOT_SELECTED";
    readonly SELECTED: "SELECTED";
};
/**
 * @public
 */
export type SelectionStatus = (typeof SelectionStatus)[keyof typeof SelectionStatus];
/**
 * @public
 * @enum
 */
export declare const TextType: {
    readonly HANDWRITING: "HANDWRITING";
    readonly PRINTED: "PRINTED";
};
/**
 * @public
 */
export type TextType = (typeof TextType)[keyof typeof TextType];
/**
 * @public
 * @enum
 */
export declare const ValueType: {
    readonly DATE: "DATE";
};
/**
 * @public
 */
export type ValueType = (typeof ValueType)[keyof typeof ValueType];
/**
 * @public
 * @enum
 */
export declare const AutoUpdate: {
    readonly DISABLED: "DISABLED";
    readonly ENABLED: "ENABLED";
};
/**
 * @public
 */
export type AutoUpdate = (typeof AutoUpdate)[keyof typeof AutoUpdate];
/**
 * @public
 * @enum
 */
export declare const JobStatus: {
    readonly FAILED: "FAILED";
    readonly IN_PROGRESS: "IN_PROGRESS";
    readonly PARTIAL_SUCCESS: "PARTIAL_SUCCESS";
    readonly SUCCEEDED: "SUCCEEDED";
};
/**
 * @public
 */
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
