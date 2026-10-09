import { type WaiterConfiguration, type WaiterResult } from "@smithy/core/client";
import { type DescribeImportCommandInput, type DescribeImportCommandOutput } from "../commands/DescribeImportCommand";
import type { DynamoDBClient } from "../DynamoDBClient";
import type { DynamoDBServiceException } from "../models/DynamoDBServiceException";
/**
 *
 *  @deprecated Use waitUntilImportCompleted instead. waitForImportCompleted does not throw error in non-success cases.
 */
export declare const waitForImportCompleted: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeImportCommandInput) => Promise<WaiterResult<DescribeImportCommandOutput | DynamoDBServiceException>>;
/**
 *
 *  @param params - Waiter configuration options.
 *  @param input - The input to DescribeImportCommand for polling.
 */
export declare const waitUntilImportCompleted: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeImportCommandInput) => Promise<WaiterResult<DescribeImportCommandOutput>>;
