/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { EuiDataGridSorting } from '@elastic/eui';
import { decodeOrThrow } from '@kbn/io-ts-utils';
import React from 'react';
import useEffectOnce from 'react-use/lib/useEffectOnce';
import {
  entityPaginationRt,
  type EntityColumnIds,
  type EntityPagination,
} from '../../../common/entities';
import { useInventoryAbortableAsync } from '../../hooks/use_inventory_abortable_async';
import { useInventoryParams } from '../../hooks/use_inventory_params';
import { useInventoryRouter } from '../../hooks/use_inventory_router';
import { useKibana } from '../../hooks/use_kibana';
import { useUnifiedSearchContext } from '../../hooks/use_unified_search_context';
import { EntitiesGrid } from '../entities_grid';
import { InventorySummary } from '../grouped_inventory/inventory_summary';

const paginationDecoder = decodeOrThrow(entityPaginationRt);

export function UnifiedInventory() {
  const {
    services: { inventoryAPIClient },
  } = useKibana();
  const { refreshSubject$, isControlPanelsInitiated, stringifiedEsQuery } =
    useUnifiedSearchContext();
  const { query } = useInventoryParams('/');
  const { sortDirection, sortField, pagination: paginationQuery } = query;

  let pagination: EntityPagination | undefined = {};
  const inventoryRoute = useInventoryRouter();
  try {
    pagination = paginationDecoder(paginationQuery);
  } catch (error) {
    inventoryRoute.push('/', {
      path: {},
      query: {
        ...query,
        pagination: undefined,
      },
    });
    window.location.reload();
  }

  const pageIndex = pagination?.unified ?? 0;

  const {
    value = { entities: [] },
    loading,
    refresh,
  } = useInventoryAbortableAsync(
    ({ signal }) => {
      if (isControlPanelsInitiated) {
        return inventoryAPIClient.fetch('GET /internal/inventory/entities', {
          params: {
            query: {
              sortDirection,
              sortField,
              esQuery: stringifiedEsQuery,
            },
          },
          signal,
        });
      }
    },
    [inventoryAPIClient, sortDirection, sortField, isControlPanelsInitiated, stringifiedEsQuery]
  );

  useEffectOnce(() => {
    const refreshSubscription = refreshSubject$.subscribe(refresh);
    return () => refreshSubscription.unsubscribe();
  });

  function handlePageChange(nextPage: number) {
    inventoryRoute.push('/', {
      path: {},
      query: {
        ...query,
        pagination: entityPaginationRt.encode({
          ...pagination,
          unified: nextPage,
        }),
      },
    });
  }

  function handleSortChange(sorting: EuiDataGridSorting['columns'][0]) {
    inventoryRoute.push('/', {
      path: {},
      query: {
        ...query,
        sortField: sorting.id as EntityColumnIds,
        sortDirection: sorting.direction,
      },
    });
  }

  return (
    <>
      <InventorySummary />
      <EntitiesGrid
        entities={value.entities}
        loading={loading}
        sortDirection={sortDirection}
        sortField={sortField}
        onChangePage={handlePageChange}
        onChangeSort={handleSortChange}
        pageIndex={pageIndex}
      />
    </>
  );
}
