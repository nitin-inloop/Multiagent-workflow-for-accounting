import { type WaiterConfiguration, type WaiterResult } from "@smithy/core/client";
import { type DescribeExportCommandInput, type DescribeExportCommandOutput } from "../commands/DescribeExportCommand";
import type { DynamoDBClient } from "../DynamoDBClient";
import type { DynamoDBServiceException } from "../models/DynamoDBServiceException";
/**
 *
 *  @deprecated Use waitUntilExportCompleted instead. waitForExportCompleted does not throw error in non-success cases.
 */
export declare const waitForExportCompleted: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeExportCommandInput) => Promise<WaiterResult<DescribeExportCommandOutput | DynamoDBServiceException>>;
/**
 *
 *  @param params - Waiter configuration options.
 *  @param input - The input to DescribeExportCommand for polling.
 */
export declare const waitUntilExportCompleted: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeExportCommandInput) => Promise<WaiterResult<DescribeExportCommandOutput>>;
