import { Paginator } from "@smithy/types";
import {
  ListAdaptersCommandInput,
  ListAdaptersCommandOutput,
} from "../commands/ListAdaptersCommand";
import { TextractPaginationConfiguration } from "./Interfaces";
export declare const paginateListAdapters: (
  config: TextractPaginationConfiguration,
  input: ListAdaptersCommandInput,
  ...rest: any[]
) => Paginator<ListAdaptersCommandOutput>;
