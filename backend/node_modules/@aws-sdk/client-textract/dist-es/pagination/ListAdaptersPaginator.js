import { createPaginator } from "@smithy/core";
import { ListAdaptersCommand, } from "../commands/ListAdaptersCommand";
import { TextractClient } from "../TextractClient";
export const paginateListAdapters = createPaginator(TextractClient, ListAdaptersCommand, "NextToken", "NextToken", "MaxResults");
