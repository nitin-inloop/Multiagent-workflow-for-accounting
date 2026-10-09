import { Paginator } from "@smithy/types";
import {
  ListAdapterVersionsCommandInput,
  ListAdapterVersionsCommandOutput,
} from "../commands/ListAdapterVersionsCommand";
import { TextractPaginationConfiguration } from "./Interfaces";
export declare const paginateListAdapterVersions: (
  config: TextractPaginationConfiguration,
  input: ListAdapterVersionsCommandInput,
  ...rest: any[]
) => Paginator<ListAdapterVersionsCommandOutput>;
