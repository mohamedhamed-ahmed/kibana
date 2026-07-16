/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useCallback, useState } from 'react';
import { css } from '@emotion/react';
import { EuiButtonIcon, EuiFlexGroup, EuiPanel, useEuiTheme } from '@elastic/eui';
import type { UseEuiTheme } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { MiniMap, useReactFlow } from '@xyflow/react';
import { FIT_VIEW_DURATION, MINIMAP_HEIGHT, MINIMAP_WIDTH } from './canvas_constants';
import { DESTINATION_NODE_TYPE, SOURCE_NODE_TYPE } from './types';
import { MapFoldedIcon } from './map_folded_icon';

/**
 * Colors the minimap blips by node type so the shape of the graph is legible at
 * a glance. Uses semantic EUI tokens so it adapts to light and dark themes.
 */
const getNodeColor =
  (euiTheme: UseEuiTheme['euiTheme']) =>
  (node: { type?: string }): string => {
    switch (node.type) {
      case SOURCE_NODE_TYPE:
        return euiTheme.colors.primary;
      case DESTINATION_NODE_TYPE:
        return euiTheme.colors.success;
      default:
        return euiTheme.colors.warning; // fallback
    }
  };

/**
 * A small overview of the entire graph pinned to the bottom-right, with a
 * movable/zoomable viewport indicator and type-colored blips. It collapses to a
 * single folded-map button to reclaim space and reopens just as easily. Must
 * render inside a `ReactFlowProvider`. Mirroring a highlighted flow's focus
 * (dimming the rest) is intentionally deferred until the flow-highlight feature
 * lands.
 */
export function CanvasMinimap() {
  const { euiTheme } = useEuiTheme();
  const { setCenter } = useReactFlow();
  const [collapsed, setCollapsed] = useState(false);

  const expand = useCallback(() => setCollapsed(false), []);
  const collapse = useCallback(() => setCollapsed(true), []);

  const expandLabel = i18n.translate('xpack.streams.canvas.minimap.expandLabel', {
    defaultMessage: 'Show minimap',
  });
  const collapseLabel = i18n.translate('xpack.streams.canvas.minimap.collapseLabel', {
    defaultMessage: 'Hide minimap',
  });

  if (collapsed) {
    return (
      <EuiPanel
        element="button"
        grow={false}
        hasShadow={false}
        hasBorder
        paddingSize="none"
        aria-label={expandLabel}
        title={expandLabel}
        onClick={expand}
        data-test-subj="streamsCanvasMinimapExpand"
        css={css`
          position: absolute;
          right: ${euiTheme.size.l};
          bottom: ${euiTheme.size.l};
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: ${euiTheme.size.s};
          /* EuiPanel's isClickable style forces width: 100% on enabled buttons;
             override it so the collapsed button stays a 32px square. */
          inline-size: 32px !important;
          block-size: 32px;
          border-radius: ${euiTheme.border.radius.medium};
          color: ${euiTheme.colors.textParagraph};
          &:hover {
            background-color: ${euiTheme.colors.backgroundBaseSubdued};
          }
        `}
      >
        <MapFoldedIcon />
      </EuiPanel>
    );
  }

  return (
    <EuiPanel
      hasShadow={false}
      hasBorder
      paddingSize="xs"
      data-test-subj="streamsCanvasMinimap"
      css={css`
        position: absolute;
        right: ${euiTheme.size.l};
        bottom: ${euiTheme.size.l};
        z-index: 5;
        border-radius: ${euiTheme.border.radius.medium};
      `}
    >
      <EuiFlexGroup justifyContent="flexEnd" gutterSize="none" responsive={false}>
        <EuiButtonIcon
          iconType="minus"
          color="text"
          size="xs"
          aria-label={collapseLabel}
          title={collapseLabel}
          onClick={collapse}
          data-test-subj="streamsCanvasMinimapCollapse"
        />
      </EuiFlexGroup>
      <MiniMap
        pannable
        zoomable
        ariaLabel={i18n.translate('xpack.streams.canvas.minimap.ariaLabel', {
          defaultMessage: 'Canvas minimap',
        })}
        nodeColor={getNodeColor(euiTheme)}
        nodeStrokeWidth={2}
        nodeBorderRadius={3}
        bgColor={euiTheme.colors.backgroundBaseSubdued}
        maskStrokeColor={euiTheme.colors.primary}
        maskStrokeWidth={2}
        onClick={(_event, position) =>
          setCenter(position.x, position.y, { duration: FIT_VIEW_DURATION })
        }
        // Sit in normal flow inside the panel instead of React Flow's own
        // absolute bottom-right corner.
        style={{
          position: 'relative',
          inset: 'auto',
          margin: 0,
          width: MINIMAP_WIDTH,
          height: MINIMAP_HEIGHT,
          borderRadius: euiTheme.border.radius.small,
        }}
      />
    </EuiPanel>
  );
}
