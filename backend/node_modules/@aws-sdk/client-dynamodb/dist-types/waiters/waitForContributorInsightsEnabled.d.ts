import { type WaiterConfiguration, type WaiterResult } from "@smithy/core/client";
import { type DescribeContributorInsightsCommandInput, type DescribeContributorInsightsCommandOutput } from "../commands/DescribeContributorInsightsCommand";
import type { DynamoDBClient } from "../DynamoDBClient";
import type { DynamoDBServiceException } from "../models/DynamoDBServiceException";
/**
 *
 *  @deprecated Use waitUntilContributorInsightsEnabled instead. waitForContributorInsightsEnabled does not throw error in non-success cases.
 */
export declare const waitForContributorInsightsEnabled: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeContributorInsightsCommandInput) => Promise<WaiterResult<DescribeContributorInsightsCommandOutput | DynamoDBServiceException>>;
/**
 *
 *  @param params - Waiter configuration options.
 *  @param input - The input to DescribeContributorInsightsCommand for polling.
 */
export declare const waitUntilContributorInsightsEnabled: (params: WaiterConfiguration<DynamoDBClient>, input: DescribeContributorInsightsCommandInput) => Promise<WaiterResult<DescribeContributorInsightsCommandOutput>>;
