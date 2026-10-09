import { createPaginator } from "@smithy/core";
import { ListAdapterVersionsCommand, } from "../commands/ListAdapterVersionsCommand";
import { TextractClient } from "../TextractClient";
export const paginateListAdapterVersions = createPaginator(TextractClient, ListAdapterVersionsCommand, "NextToken", "NextToken", "MaxResults");
