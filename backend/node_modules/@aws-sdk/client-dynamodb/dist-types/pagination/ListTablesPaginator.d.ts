import type { Paginator } from "@smithy/types";
import { ListTablesCommandInput, ListTablesCommandOutput } from "../commands/ListTablesCommand";
import type { DynamoDBPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateListTables: (config: DynamoDBPaginationConfiguration, input: ListTablesCommandInput, ...rest: any[]) => Paginator<ListTablesCommandOutput>;
