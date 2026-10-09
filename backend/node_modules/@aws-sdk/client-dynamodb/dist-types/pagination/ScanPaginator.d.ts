import type { Paginator } from "@smithy/types";
import { ScanCommandInput, ScanCommandOutput } from "../commands/ScanCommand";
import type { DynamoDBPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateScan: (config: DynamoDBPaginationConfiguration, input: ScanCommandInput, ...rest: any[]) => Paginator<ScanCommandOutput>;
