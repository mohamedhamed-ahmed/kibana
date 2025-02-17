/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useMemo } from 'react';
import type { FlyoutPanelProps } from '@kbn/expandable-flyout';
import { useExpandableFlyoutApi } from '@kbn/expandable-flyout';

import { buildEntityFlyoutPreviewQuery } from '@kbn/cloud-security-posture-common';
import { useMisconfigurationPreview } from '@kbn/cloud-security-posture/src/hooks/use_misconfiguration_preview';
import { useVulnerabilitiesPreview } from '@kbn/cloud-security-posture/src/hooks/use_vulnerabilities_preview';
import { sum } from 'lodash';
import { DETECTION_RESPONSE_ALERTS_BY_STATUS_ID } from '../../../overview/components/detection_response/alerts_by_status/types';
import { useAlertsByStatus } from '../../../overview/components/detection_response/alerts_by_status/use_alerts_by_status';
import { useRefetchQueryById } from '../../../entity_analytics/api/hooks/use_refetch_query_by_id';
import { RISK_INPUTS_TAB_QUERY_ID } from '../../../entity_analytics/components/entity_details_flyout/tabs/risk_inputs/risk_inputs_tab';
import type { Refetch } from '../../../common/types';
import { useCalculateEntityRiskScore } from '../../../entity_analytics/api/hooks/use_calculate_entity_risk_score';
import { useKibana } from '../../../common/lib/kibana/kibana_react';
import { hostToCriteria } from '../../../common/components/ml/criteria/host_to_criteria';
import { useRiskScore } from '../../../entity_analytics/api/hooks/use_risk_score';
import { useQueryInspector } from '../../../common/components/page/manage_query';
import { useGlobalTime } from '../../../common/containers/use_global_time';
import type { HostItem } from '../../../../common/search_strategy';
import { buildHostNamesFilter } from '../../../../common/search_strategy';
import { RiskScoreEntity } from '../../../../common/entity_analytics/risk_engine';
import { FlyoutLoading } from '../../shared/components/flyout_loading';
import { FlyoutNavigation } from '../../shared/components/flyout_navigation';
import { HostPanelContent } from './content';
import { HostPanelHeader } from './header';
import { AnomalyTableProvider } from '../../../common/components/ml/anomaly/anomaly_table_provider';
import type { ObservedEntityData } from '../shared/components/observed_entity/types';
import { useObservedHost } from './hooks/use_observed_host';
import { HostDetailsPanelKey } from '../host_details_left';
import { EntityDetailsLeftPanelTab } from '../shared/components/left_panel/left_panel_header';
import { HostPreviewPanelFooter } from '../host_preview/footer';
import { useSignalIndex } from '../../../detections/containers/detection_engine/alerts/use_signal_index';
import { EntityEventTypes } from '../../../common/lib/telemetry';

export interface HostPanelProps extends Record<string, unknown> {
  contextID: string;
  scopeId: string;
  hostName: string;
  isDraggable?: boolean;
  isPreviewMode?: boolean;
}

export interface HostPanelExpandableFlyoutProps extends FlyoutPanelProps {
  key: 'host-panel' | 'host-preview-panel';
  params: HostPanelProps;
}

export const HostPanelKey: HostPanelExpandableFlyoutProps['key'] = 'host-panel';
export const HostPreviewPanelKey: HostPanelExpandableFlyoutProps['key'] = 'host-preview-panel';
export const HOST_PANEL_RISK_SCORE_QUERY_ID = 'HostPanelRiskScoreQuery';
export const HOST_PANEL_OBSERVED_HOST_QUERY_ID = 'HostPanelObservedHostQuery';

const FIRST_RECORD_PAGINATION = {
  cursorStart: 0,
  querySize: 1,
};

export const HostPanel = ({
  contextID,
  scopeId,
  hostName,
  isDraggable,
  isPreviewMode,
}: HostPanelProps) => {
  const { telemetry } = useKibana().services;
  const { openLeftPanel } = useExpandableFlyoutApi();
  const { to, from, isInitializing, setQuery, deleteQuery } = useGlobalTime();
  const hostNameFilterQuery = useMemo(
    () => (hostName ? buildHostNamesFilter([hostName]) : undefined),
    [hostName]
  );

  const riskScoreState = useRiskScore({
    riskEntity: RiskScoreEntity.host,
    filterQuery: hostNameFilterQuery,
    onlyLatest: false,
    pagination: FIRST_RECORD_PAGINATION,
  });

  const { data: hostRisk, inspect: inspectRiskScore, refetch, loading } = riskScoreState;
  const hostRiskData = hostRisk && hostRisk.length > 0 ? hostRisk[0] : undefined;
  const isRiskScoreExist = !!hostRiskData?.host.risk;

  const refetchRiskInputsTab = useRefetchQueryById(RISK_INPUTS_TAB_QUERY_ID);
  const refetchRiskScore = useCallback(() => {
    refetch();
    (refetchRiskInputsTab as Refetch | null)?.();
  }, [refetch, refetchRiskInputsTab]);

  const { isLoading: recalculatingScore, calculateEntityRiskScore } = useCalculateEntityRiskScore(
    RiskScoreEntity.host,
    hostName,
    { onSuccess: refetchRiskScore }
  );

  const { data } = useMisconfigurationPreview({
    query: buildEntityFlyoutPreviewQuery('host.name', hostName),
    sort: [],
    enabled: true,
    pageSize: 1,
    ignore_unavailable: true,
  });

  const passedFindings = data?.count.passed || 0;
  const failedFindings = data?.count.failed || 0;

  const hasMisconfigurationFindings = passedFindings > 0 || failedFindings > 0;

  const { data: vulnerabilitiesData } = useVulnerabilitiesPreview({
    query: buildEntityFlyoutPreviewQuery('host.name', hostName),
    sort: [],
    enabled: true,
    pageSize: 1,
  });

  const hasVulnerabilitiesFindings = sum(Object.values(vulnerabilitiesData?.count || {})) > 0;

  const { signalIndexName } = useSignalIndex();

  const entityFilter = useMemo(() => ({ field: 'host.name', value: hostName }), [hostName]);

  const { items: alertsData } = useAlertsByStatus({
    entityFilter,
    signalIndexName,
    queryId: `${DETECTION_RESPONSE_ALERTS_BY_STATUS_ID}HOST_NAME_RIGHT`,
    to,
    from,
  });

  const hasNonClosedAlerts =
    (alertsData?.acknowledged?.total || 0) + (alertsData?.open?.total || 0) > 0;

  useQueryInspector({
    deleteQuery,
    inspect: inspectRiskScore,
    loading,
    queryId: HOST_PANEL_RISK_SCORE_QUERY_ID,
    refetch,
    setQuery,
  });

  const openTabPanel = useCallback(
    (tab?: EntityDetailsLeftPanelTab) => {
      telemetry.reportEvent(EntityEventTypes.RiskInputsExpandedFlyoutOpened, {
        entity: 'host',
      });

      openLeftPanel({
        id: HostDetailsPanelKey,
        params: {
          name: hostName,
          scopeId,
          isRiskScoreExist,
          path: tab ? { tab } : undefined,
          hasMisconfigurationFindings,
          hasVulnerabilitiesFindings,
          hasNonClosedAlerts,
        },
      });
    },
    [
      telemetry,
      openLeftPanel,
      hostName,
      scopeId,
      isRiskScoreExist,
      hasMisconfigurationFindings,
      hasVulnerabilitiesFindings,
      hasNonClosedAlerts,
    ]
  );

  const openDefaultPanel = useCallback(
    () =>
      openTabPanel(
        isRiskScoreExist
          ? EntityDetailsLeftPanelTab.RISK_INPUTS
          : EntityDetailsLeftPanelTab.CSP_INSIGHTS
      ),
    [isRiskScoreExist, openTabPanel]
  );

  const observedHost = useObservedHost(hostName, scopeId);

  if (observedHost.isLoading) {
    return <FlyoutLoading />;
  }

  return (
    <AnomalyTableProvider
      criteriaFields={hostToCriteria(observedHost.details)}
      startDate={from}
      endDate={to}
      skip={isInitializing}
    >
      {({ isLoadingAnomaliesData, anomaliesData, jobNameById }) => {
        const observedHostWithAnomalies: ObservedEntityData<HostItem> = {
          ...observedHost,
          anomalies: {
            isLoading: isLoadingAnomaliesData,
            anomalies: anomaliesData,
            jobNameById,
          },
        };

        return (
          <>
            <FlyoutNavigation
              flyoutIsExpandable={
                !isPreviewMode &&
                (isRiskScoreExist ||
                  hasMisconfigurationFindings ||
                  hasVulnerabilitiesFindings ||
                  hasNonClosedAlerts)
              }
              expandDetails={openDefaultPanel}
            />
            <HostPanelHeader hostName={hostName} observedHost={observedHostWithAnomalies} />
            <HostPanelContent
              hostName={hostName}
              observedHost={observedHostWithAnomalies}
              riskScoreState={riskScoreState}
              contextID={contextID}
              scopeId={scopeId}
              isDraggable={!!isDraggable}
              openDetailsPanel={!isPreviewMode ? openTabPanel : undefined}
              recalculatingScore={recalculatingScore}
              onAssetCriticalityChange={calculateEntityRiskScore}
              isPreviewMode={isPreviewMode}
            />
            {isPreviewMode && (
              <HostPreviewPanelFooter
                hostName={hostName}
                contextID={contextID}
                scopeId={scopeId}
                isDraggable={!!isDraggable}
              />
            )}
          </>
        );
      }}
    </AnomalyTableProvider>
  );
};

HostPanel.displayName = 'HostPanel';
