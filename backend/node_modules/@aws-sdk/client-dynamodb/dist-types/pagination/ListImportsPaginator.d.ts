import type { Paginator } from "@smithy/types";
import { ListImportsCommandInput, ListImportsCommandOutput } from "../commands/ListImportsCommand";
import type { DynamoDBPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateListImports: (config: DynamoDBPaginationConfiguration, input: ListImportsCommandInput, ...rest: any[]) => Paginator<ListImportsCommandOutput>;
