import { type WaiterConfiguration, type WaiterResult } from "@smithy/core/client";
import { type DescribeTableCommandInput, type DescribeTableCommandOutput } from "../commands/DescribeTableCommand";
import type { DynamoDBClient } from "../DynamoDBClient";
import type { DynamoDBServiceException } from "../models/DynamoDBServiceException";
import type { ResourceNotFoundException } from "../models/errors";
/**
 *
 *  @deprecated Use waitUntilTableNotExists instead. waitForTableNotExists does not throw error in non-success cases.
 */
export declare const waitForTableNotExists: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeTableCommandInput) => Promise<WaiterResult<DescribeTableCommandOutput | DynamoDBServiceException>>;
/**
 *
 *  @param params - Waiter configuration options.
 *  @param input - The input to DescribeTableCommand for polling.
 */
export declare const waitUntilTableNotExists: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeTableCommandInput) => Promise<WaiterResult<ResourceNotFoundException>>;
