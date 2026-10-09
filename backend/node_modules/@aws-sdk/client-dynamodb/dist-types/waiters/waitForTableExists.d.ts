import { type WaiterConfiguration, type WaiterResult } from "@smithy/core/client";
import { type DescribeTableCommandInput, type DescribeTableCommandOutput } from "../commands/DescribeTableCommand";
import type { DynamoDBClient } from "../DynamoDBClient";
import type { DynamoDBServiceException } from "../models/DynamoDBServiceException";
/**
 *
 *  @deprecated Use waitUntilTableExists instead. waitForTableExists does not throw error in non-success cases.
 */
export declare const waitForTableExists: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeTableCommandInput) => Promise<WaiterResult<DescribeTableCommandOutput | DynamoDBServiceException>>;
/**
 *
 *  @param params - Waiter configuration options.
 *  @param input - The input to DescribeTableCommand for polling.
 */
export declare const waitUntilTableExists: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeTableCommandInput) => Promise<WaiterResult<DescribeTableCommandOutput>>;
