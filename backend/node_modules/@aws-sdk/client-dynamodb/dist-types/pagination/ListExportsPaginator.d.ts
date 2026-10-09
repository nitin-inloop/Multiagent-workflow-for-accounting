import type { Paginator } from "@smithy/types";
import { ListExportsCommandInput, ListExportsCommandOutput } from "../commands/ListExportsCommand";
import type { DynamoDBPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateListExports: (config: DynamoDBPaginationConfiguration, input: ListExportsCommandInput, ...rest: any[]) => Paginator<ListExportsCommandOutput>;
