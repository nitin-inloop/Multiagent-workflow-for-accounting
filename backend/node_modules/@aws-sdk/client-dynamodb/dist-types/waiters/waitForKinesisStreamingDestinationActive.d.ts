import { type WaiterConfiguration, type WaiterResult } from "@smithy/core/client";
import { type DescribeKinesisStreamingDestinationCommandInput, type DescribeKinesisStreamingDestinationCommandOutput } from "../commands/DescribeKinesisStreamingDestinationCommand";
import type { DynamoDBClient } from "../DynamoDBClient";
import type { DynamoDBServiceException } from "../models/DynamoDBServiceException";
/**
 *
 *  @deprecated Use waitUntilKinesisStreamingDestinationActive instead. waitForKinesisStreamingDestinationActive does not throw error in non-success cases.
 */
export declare const waitForKinesisStreamingDestinationActive: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeKinesisStreamingDestinationCommandInput) => Promise<WaiterResult<DescribeKinesisStreamingDestinationCommandOutput | DynamoDBServiceException>>;
/**
 *
 *  @param params - Waiter configuration options.
 *  @param input - The input to DescribeKinesisStreamingDestinationCommand for polling.
 */
export declare const waitUntilKinesisStreamingDestinationActive: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeKinesisStreamingDestinationCommandInput) => Promise<WaiterResult<DescribeKinesisStreamingDestinationCommandOutput>>;
