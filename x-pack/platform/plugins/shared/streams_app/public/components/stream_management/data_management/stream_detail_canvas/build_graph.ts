/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IconType } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { Streams } from '@kbn/streams-schema';
import { layoutGraph } from './layout';
import {
  ANIMATED_EDGE_TYPE,
  DESTINATION_NODE_TYPE,
  SOURCE_NODE_TYPE,
  type ClassicCanvasGraph,
  type ClassicCanvasNode,
  type DestinationNodeData,
  type SourceNodeData,
} from './types';

/**
 * Classic streams have no first-class `source` for now, so we infer a generic async
 * `_bulk` (async_bulk) source.
 */
export const BULK_SOURCE_SUBTITLE = '_bulk';

const SOURCE_ICON_TYPE: IconType = 'push';

/** A classic stream has processing when it carries at least one Streamlang step. */
export const hasProcessing = (definition: Streams.ClassicStream.Definition): boolean =>
  (definition.ingest.processing.steps?.length ?? 0) > 0;

export const inferSource = (definition: Streams.ClassicStream.Definition): SourceNodeData => ({
  title: definition.name,
  subtitle: BULK_SOURCE_SUBTITLE,
  iconType: SOURCE_ICON_TYPE,
});

const buildDestination = (definition: Streams.ClassicStream.Definition): DestinationNodeData => ({
  title: definition.name,
  hasProcessing: hasProcessing(definition),
});

/** Accessible name announced when a source node receives keyboard focus. */
export const getSourceAriaLabel = (definition: Streams.ClassicStream.Definition): string =>
  i18n.translate('xpack.streams.canvas.sourceNode.ariaLabel', {
    defaultMessage: 'Source: {name}, async bulk ingest',
    values: { name: definition.name },
  });

/** Accessible name announced when a destination node receives keyboard focus. */
export const getDestinationAriaLabel = (definition: Streams.ClassicStream.Definition): string =>
  hasProcessing(definition)
    ? i18n.translate('xpack.streams.canvas.destinationNode.ariaLabelWithProcessing', {
        defaultMessage: 'Destination: {name}, with processing',
        values: { name: definition.name },
      })
    : i18n.translate('xpack.streams.canvas.destinationNode.ariaLabel', {
        defaultMessage: 'Destination: {name}',
        values: { name: definition.name },
      });

export const buildClassicStreamsGraph = (
  streams: Streams.ClassicStream.Definition[]
): ClassicCanvasGraph => {
  const nodes: ClassicCanvasNode[] = [];
  const edges: ClassicCanvasGraph['edges'] = [];

  streams.forEach((definition) => {
    const sourceId = `source-${definition.name}`;
    const destinationId = `destination-${definition.name}`;

    nodes.push({
      id: sourceId,
      type: SOURCE_NODE_TYPE,
      position: { x: 0, y: 0 },
      ariaLabel: getSourceAriaLabel(definition),
      data: inferSource(definition),
    });

    nodes.push({
      id: destinationId,
      type: DESTINATION_NODE_TYPE,
      position: { x: 0, y: 0 },
      ariaLabel: getDestinationAriaLabel(definition),
      data: buildDestination(definition),
    });

    edges.push({
      id: `${sourceId}->${destinationId}`,
      source: sourceId,
      target: destinationId,
      type: ANIMATED_EDGE_TYPE,
    });
  });

  // Positions come from the shared auto-layout so the placement logic stays in
  // one place and extends to richer topologies (pipelines, routing) later.
  const positions = layoutGraph(nodes, edges);
  const positionedNodes = nodes.map((node) => ({
    ...node,
    position: positions.get(node.id) ?? node.position,
  })) as ClassicCanvasNode[];

  return { nodes: positionedNodes, edges };
};
