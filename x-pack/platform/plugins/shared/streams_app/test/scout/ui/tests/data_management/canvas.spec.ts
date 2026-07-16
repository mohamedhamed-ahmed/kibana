/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { tags } from '@kbn/scout';
import { OBSERVABILITY_STREAMS_ENABLE_CANVAS } from '@kbn/management-settings-ids';
import { expect } from '@kbn/scout/ui';
import { test } from '../../fixtures';
import { generateLogsData } from '../../fixtures/generators';

const INGESTION_DURATION_MINUTES = 5;
const INGESTION_RATE = 10;
const PLAIN_STREAM = 'logs-canvas-plain';
const PROCESSING_STREAM = 'logs-canvas-processing';

test.describe(
  'Stream canvas - classic source to destination nodes',
  { tag: [...tags.stateful.classic, ...tags.serverless.observability.complete] },
  () => {
    test.beforeAll(async ({ kbnClient, apiServices, logsSynthtraceEsClient }) => {
      await kbnClient.uiSettings.update({
        [OBSERVABILITY_STREAMS_ENABLE_CANVAS]: true,
      });

      const currentTime = Date.now();
      const startTime = new Date(
        currentTime - INGESTION_DURATION_MINUTES * 60 * 1000
      ).toISOString();
      const endTime = new Date(currentTime).toISOString();

      for (const index of [PLAIN_STREAM, PROCESSING_STREAM]) {
        await generateLogsData(logsSynthtraceEsClient)({
          index,
          startTime,
          endTime,
          docsPerMinute: INGESTION_RATE,
        });
      }

      // Give one stream processing so its destination renders the processing glyph.
      await apiServices.streams.updateStreamProcessors(PROCESSING_STREAM, {
        steps: [
          {
            action: 'set',
            to: 'canvas_test_field',
            value: 'canvas_test_value',
          },
        ],
      });
    });

    test.beforeEach(async ({ browserAuth, pageObjects }) => {
      await browserAuth.loginAsAdmin();
      // The canvas renders all classic streams regardless of which one is open.
      await pageObjects.streams.gotoCanvasTab(PLAIN_STREAM);
    });

    test.afterAll(async ({ kbnClient, apiServices }) => {
      for (const name of [PLAIN_STREAM, PROCESSING_STREAM]) {
        try {
          await apiServices.streams.deleteStream(name);
        } catch {
          // stream may already be gone
        }
      }

      await kbnClient.uiSettings.update({
        [OBSERVABILITY_STREAMS_ENABLE_CANVAS]: false,
      });
    });

    test('renders inferred source and destination nodes for classic streams', async ({ page }) => {
      await expect(page.locator('[data-test-subj="streamsCanvasTab"]')).toBeVisible();

      // The inferred source node is labeled from the stream name.
      await expect(
        page.locator('[data-test-subj="streamsCanvasSourceNode"]', { hasText: PLAIN_STREAM })
      ).toBeVisible();

      // Both seeded streams render as their own destination node.
      await expect(
        page.locator('[data-test-subj="streamsCanvasDestinationNode"]', { hasText: PLAIN_STREAM })
      ).toBeVisible();
      await expect(
        page.locator('[data-test-subj="streamsCanvasDestinationNode"]', {
          hasText: PROCESSING_STREAM,
        })
      ).toBeVisible();
    });

    test('renders the custom zoom and fit-to-screen controls', async ({ page }) => {
      await expect(page.locator('[data-test-subj="streamsCanvasZoomControls"]')).toBeVisible();
      await expect(page.locator('[data-test-subj="streamsCanvasZoomIn"]')).toBeVisible();
      await expect(page.locator('[data-test-subj="streamsCanvasZoomOut"]')).toBeVisible();
      await expect(page.locator('[data-test-subj="streamsCanvasFitToScreen"]')).toBeVisible();
    });

    test('renders a minimap that collapses and reopens', async ({ page }) => {
      const minimap = page.locator('[data-test-subj="streamsCanvasMinimap"]');
      await expect(minimap).toBeVisible();

      await page.locator('[data-test-subj="streamsCanvasMinimapCollapse"]').click();
      await expect(minimap).toHaveCount(0);
      await expect(page.locator('[data-test-subj="streamsCanvasMinimapExpand"]')).toBeVisible();

      await page.locator('[data-test-subj="streamsCanvasMinimapExpand"]').click();
      await expect(page.locator('[data-test-subj="streamsCanvasMinimap"]')).toBeVisible();
    });

    test('tidies up the whole graph from the pane menu and enables undo', async ({ page }) => {
      // A single node has no tidy action, so right-clicking one opens no menu.
      const destination = page.locator('[data-test-subj="streamsCanvasDestinationNode"]', {
        hasText: PLAIN_STREAM,
      });
      await destination.click({ button: 'right' });
      await expect(page.locator('[data-test-subj="streamsCanvasContextMenu"]')).toHaveCount(0);

      // Right-clicking the empty canvas offers "Tidy up" for the whole graph.
      await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 5, y: 5 } });

      await expect(page.locator('[data-test-subj="streamsCanvasContextMenu"]')).toBeVisible();
      const tidyUp = page.locator('[data-test-subj="streamsCanvasContextMenuTidyUp"]');
      await expect(tidyUp).toBeVisible();

      await tidyUp.click();
      await expect(page.locator('[data-test-subj="streamsCanvasContextMenu"]')).toHaveCount(0);
      // Tidying records a history step, so undo becomes available.
      await expect(page.locator('[data-test-subj="streamsCanvasUndo"]')).toBeEnabled();
    });

    test('renders the canvas toolbar with undo/redo and add-node placeholders', async ({
      page,
    }) => {
      await expect(page.locator('[data-test-subj="streamsCanvasToolbar"]')).toBeVisible();

      // Undo/redo start disabled since nothing has been changed yet.
      await expect(page.locator('[data-test-subj="streamsCanvasUndo"]')).toBeDisabled();
      await expect(page.locator('[data-test-subj="streamsCanvasRedo"]')).toBeDisabled();

      await expect(page.locator('[data-test-subj="streamsCanvasAddSource"]')).toBeVisible();
      await expect(page.locator('[data-test-subj="streamsCanvasAddDestination"]')).toBeVisible();
    });

    test('exposes accessible node labels and keyboard controls', async ({ page }) => {
      // Nodes carry a screen-reader label so Tab-focusing announces what they are.
      await expect(
        page.locator(`.react-flow__node[aria-label="Source: ${PLAIN_STREAM}, async bulk ingest"]`)
      ).toBeVisible();

      // Escape closes an open context menu.
      await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 5, y: 5 } });
      await expect(page.locator('[data-test-subj="streamsCanvasContextMenu"]')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-test-subj="streamsCanvasContextMenu"]')).toHaveCount(0);

      // Tidy up records a history step; Ctrl+Z (focus inside the canvas) undoes it.
      await page.locator('.react-flow__pane').click({ button: 'right', position: { x: 5, y: 5 } });
      await page.locator('[data-test-subj="streamsCanvasContextMenuTidyUp"]').click();
      await expect(page.locator('[data-test-subj="streamsCanvasUndo"]')).toBeEnabled();

      const destination = page.locator('[data-test-subj="streamsCanvasDestinationNode"]', {
        hasText: PLAIN_STREAM,
      });
      await destination.click();
      await page.keyboard.press('Control+z');
      await expect(page.locator('[data-test-subj="streamsCanvasUndo"]')).toBeDisabled();
    });

    test('shows the processing glyph only on destinations with processing', async ({ page }) => {
      const processingDestination = page.locator(
        '[data-test-subj="streamsCanvasDestinationNode"]',
        { hasText: PROCESSING_STREAM }
      );
      await expect(
        processingDestination.locator('[data-test-subj="streamsCanvasProcessingGlyph"]')
      ).toBeVisible();

      const plainDestination = page.locator('[data-test-subj="streamsCanvasDestinationNode"]', {
        hasText: PLAIN_STREAM,
      });
      await expect(
        plainDestination.locator('[data-test-subj="streamsCanvasProcessingGlyph"]')
      ).toHaveCount(0);
    });
  }
);
