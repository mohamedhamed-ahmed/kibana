/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { XYPosition } from '@xyflow/react';
import { COLUMN_GAP, COMPONENT_GAP, ROW_GAP } from './canvas_constants';

interface LayoutNode {
  id: string;
}

interface LayoutEdge {
  source: string;
  target: string;
}

/**
 * Deterministic, dependency-free left-to-right layered layout.
 *
 * Data flows left -> right, so each node's column is its longest-path depth from
 * a root (a node with no incoming edges). Independent flows (connected
 * components) are stacked top-to-bottom in their own bands so unrelated flows
 * never interleave.
 *
 * For the current classic topology (one source -> destination pair per stream)
 * this reduces to source in column 0, destination in column 1, one component per
 * row. It generalizes cleanly to pipeline/routing columns once the API provides
 * them, without changing callers.
 */
export const layoutGraph = (nodes: LayoutNode[], edges: LayoutEdge[]): Map<string, XYPosition> => {
  const positions = new Map<string, XYPosition>();
  if (nodes.length === 0) {
    return positions;
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const validEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  const outgoing = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  const incoming = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  const undirected = new Map<string, Set<string>>(nodes.map((node) => [node.id, new Set()]));

  validEdges.forEach(({ source, target }) => {
    outgoing.get(source)!.push(target);
    incoming.get(target)!.push(source);
    undirected.get(source)!.add(target);
    undirected.get(target)!.add(source);
  });

  // Partition into connected components, preserving node insertion order.
  const componentByNode = new Map<string, number>();
  const components: LayoutNode[][] = [];
  nodes.forEach((node) => {
    if (componentByNode.has(node.id)) {
      return;
    }
    const index = components.length;
    const group: LayoutNode[] = [];
    const stack = [node.id];
    componentByNode.set(node.id, index);
    while (stack.length) {
      const id = stack.pop()!;
      group.push({ id });
      undirected.get(id)!.forEach((neighbour) => {
        if (!componentByNode.has(neighbour)) {
          componentByNode.set(neighbour, index);
          stack.push(neighbour);
        }
      });
    }
    components.push(group);
  });

  // Keep the node order stable within each component
  const orderIndex = new Map(nodes.map((node, index) => [node.id, index]));
  components.forEach((group) =>
    group.sort((a, b) => orderIndex.get(a.id)! - orderIndex.get(b.id)!)
  );

  let yCursor = 0;

  components.forEach((group) => {
    const groupIds = new Set(group.map((node) => node.id));

    // Longest-path layering: a node's column is the longest chain of incoming
    // edges leading to it from a root within this component.
    const layer = new Map<string, number>();
    const remainingIn = new Map<string, number>(
      group.map((node) => [node.id, incoming.get(node.id)!.filter((s) => groupIds.has(s)).length])
    );
    const queue = group.filter((node) => remainingIn.get(node.id) === 0).map((node) => node.id);
    queue.forEach((id) => layer.set(id, 0));

    while (queue.length) {
      const id = queue.shift()!;
      const currentLayer = layer.get(id) ?? 0;
      outgoing.get(id)!.forEach((target) => {
        if (!groupIds.has(target)) {
          return;
        }
        layer.set(target, Math.max(layer.get(target) ?? 0, currentLayer + 1));
        remainingIn.set(target, (remainingIn.get(target) ?? 0) - 1);
        if ((remainingIn.get(target) ?? 0) === 0) {
          queue.push(target);
        }
      });
    }

    // Any node not reached (e.g. a cycle) defaults to column 0.
    group.forEach((node) => {
      if (!layer.has(node.id)) {
        layer.set(node.id, 0);
      }
    });

    const columns = new Map<number, string[]>();
    group.forEach((node) => {
      const columnIndex = layer.get(node.id)!;
      if (!columns.has(columnIndex)) {
        columns.set(columnIndex, []);
      }
      columns.get(columnIndex)!.push(node.id);
    });

    const rowsInBand = Math.max(...[...columns.values()].map((column) => column.length));
    const bandHeight = (rowsInBand - 1) * ROW_GAP;

    columns.forEach((columnIds, columnIndex) => {
      // Vertically center each column within the band so short columns align to
      // the middle of taller ones.
      const columnOffset = (bandHeight - (columnIds.length - 1) * ROW_GAP) / 2;
      columnIds.forEach((id, rowIndex) => {
        positions.set(id, {
          x: columnIndex * COLUMN_GAP,
          y: yCursor + columnOffset + rowIndex * ROW_GAP,
        });
      });
    });

    yCursor += bandHeight + ROW_GAP + COMPONENT_GAP;
  });

  return positions;
};

interface PositionedNode {
  id: string;
  position: XYPosition;
}

interface ApplyLayoutOptions {
  /**
   * When provided, only these nodes are re-laid-out (a "Tidy up selection");
   * everything else keeps its current position and the tidied block is anchored
   * to the selection's current top-left so it arranges in place instead of
   * jumping to the origin.
   */
  onlyIds?: Set<string>;
}

/**
 * Re-runs {@link layoutGraph} against live nodes and returns a new array with the
 * updated positions, preserving every other node property. This is the runtime
 * "Tidy up" action; the build-time graph builder keeps using `layoutGraph`
 * directly.
 */
export const applyLayout = <N extends PositionedNode>(
  nodes: N[],
  edges: LayoutEdge[],
  { onlyIds }: ApplyLayoutOptions = {}
): N[] => {
  const targetNodes = onlyIds ? nodes.filter((node) => onlyIds.has(node.id)) : nodes;
  if (targetNodes.length === 0) {
    return nodes;
  }

  const targetIds = new Set(targetNodes.map((node) => node.id));
  const targetEdges = edges.filter(
    (edge) => targetIds.has(edge.source) && targetIds.has(edge.target)
  );

  const positions = layoutGraph(targetNodes, targetEdges);

  // For a selection-only tidy, shift the laid-out block back onto the
  // selection's current top-left so it stays where the user is looking.
  let offsetX = 0;
  let offsetY = 0;
  if (onlyIds) {
    const laidPositions = [...positions.values()];
    const currentMinX = Math.min(...targetNodes.map((node) => node.position.x));
    const currentMinY = Math.min(...targetNodes.map((node) => node.position.y));
    const laidMinX = Math.min(...laidPositions.map((position) => position.x));
    const laidMinY = Math.min(...laidPositions.map((position) => position.y));
    offsetX = currentMinX - laidMinX;
    offsetY = currentMinY - laidMinY;
  }

  return nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position) {
      return node;
    }
    return { ...node, position: { x: position.x + offsetX, y: position.y + offsetY } };
  });
};
