/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import {
  SerializedTitles,
  PublishesWritablePanelTitle,
  PublishesPanelTitle,
  HasEditCapabilities,
} from '@kbn/presentation-publishing';
import type { EmbeddableApiContext } from '@kbn/presentation-publishing';
import { DefaultEmbeddableApi } from '@kbn/embeddable-plugin/public';
import { Filter } from '@kbn/es-query';

export type OverviewMode = 'single' | 'groups';
export type GroupBy = 'slo.tags' | 'status' | 'slo.indicator.type';
export interface GroupFilters {
  groupBy: GroupBy;
  groups?: string[];
  filters?: Filter[];
  kqlQuery?: string;
}

export interface SloConfigurationProps {
  overviewMode?: OverviewMode;
}

export type SingleSloCustomInput = SloConfigurationProps & {
  sloId: string | undefined;
  sloInstanceId: string | undefined;
  remoteName?: string;
  showAllGroupByInstances?: boolean;
};

export type GroupSloCustomInput = SloConfigurationProps & {
  groupFilters: GroupFilters | undefined;
};

export type SloOverviewEmbeddableState = SerializedTitles &
  Partial<GroupSloCustomInput> &
  Partial<SingleSloCustomInput>;

export type SloOverviewApi = DefaultEmbeddableApi<SloOverviewEmbeddableState> &
  PublishesWritablePanelTitle &
  PublishesPanelTitle &
  HasSloGroupOverviewConfig &
  HasEditCapabilities;

export interface HasSloGroupOverviewConfig {
  getSloGroupOverviewConfig: () => GroupSloCustomInput;
  updateSloGroupOverviewConfig: (next: GroupSloCustomInput) => void;
}

export const apiHasSloGroupOverviewConfig = (
  api: unknown | null
): api is HasSloGroupOverviewConfig => {
  return Boolean(
    api &&
      typeof (api as HasSloGroupOverviewConfig).getSloGroupOverviewConfig === 'function' &&
      typeof (api as HasSloGroupOverviewConfig).updateSloGroupOverviewConfig === 'function'
  );
};

export type SloOverviewEmbeddableActionContext = EmbeddableApiContext & {
  embeddable: SloOverviewApi;
};
