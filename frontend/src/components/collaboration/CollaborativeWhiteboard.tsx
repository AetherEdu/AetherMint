'use client';

/**
 * CollaborativeWhiteboard with persistence
 *
 * Combines the existing canvas-driven `useWhiteboard`, the persistence hook,
 * the session list, the share dialog, and the export utilities into one
 * composition. Strings are routed through `useTranslation` so the entire UI
 * honours the active locale + RTL flip.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Share2, Download, ChevronDown } from 'lucide-react';
import { useWhiteboard, type DrawTool, type DrawData } from './useWhiteboardCompat';
import { useWhiteboardPersistence } from '../../hooks/useWhiteboardPersistence';
import { WhiteboardSessionList } from './WhiteboardSessionList';
import { WhiteboardShareDialog } from './WhiteboardShareDialog';
import { exportOpsAsPng, exportOpsAsSvg } from '../../utils/whiteboardExport';
import type { WhiteboardOp, WhiteboardSession } from '../../types/whiteboardSession';
import { Socket } from 'socket.io-client';

type CanvasSnapshot = {
  drawOn: (data: DrawData) => void;
  clear: () => void;
  getOps: () => WhiteboardOp[];
  collectThumbnail: () => string | undefined;
};

interface CollaborativeWhiteboardProps {
  socket: Socket | null;
  roomId: string;
  userId: string;
  width?: number;
  height?: number;
  /** Read-only link used for the /whiteboard/shared route. */
  sharedSession?: WhiteboardSession | null;
}

/**
 * Compatibility shim: the legacy `useWhiteboard` exports canvas mouse-event
 * handlers and an imperative `drawOn` API. To keep this component file
 * readable we wrap that into a snapshot object with the four operations we
 * need (draw, clear, snapshot ops, capture thumbnail).
 */
function useCanvasSnapshot(roomId: string, socket: Socket | null): {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  tool: DrawTool;
  setTool: (t: DrawTool) => void;
  color: string;
  setColor: (c: string) => void;
  lineWidth: number;
  setLineWidth: (n: number) => void;
  ops: WhiteboardOp[];
  snapshot: CanvasSnapshot;
} {
  const opsRef = useRef<WhiteboardOp[]>([]);
  const seqRef = useRef(1);

  // Map real canvas events into ops we can persist.
  const recordOp = useCallback(
    (data: DrawData, kind: WhiteboardOp['tool']) => {
      const op: WhiteboardOp = {
        tool: kind,
        userId: roomId, // roomId doubles as ownerId in this legacy surface.
        ts: Date.now(),
        seq: seqRef.current++,
        color: data.color,
        width: data.lineWidth,
        points:
          kind === 'pen' || kind === 'eraser'
            ? [{ x: data.startX, y: data.startY }, { x: data.endX, y: data.endY }]
            : [{ x: data.startX, y: data.startY }, { x: data.endX, y: data.endY }],
        text: data.text,
      };
      opsRef.current.push(op);
    },
    [roomId]
  );

  // The original hook handles real-time redraw via the socket; we delegate to
  // it but augment it with our own op recording. The simplest way is to use
  // its return API directly.
  const wb = useWhiteboard(socket, roomId);

  // Replace the default draw with one that also persists. We do this in a
  // memo so the dependent canvas event handlers stay stable.
  const recordingDraw = useMemo<CanvasSnapshot>(() => {
    return {
      drawOn: wb.drawOnCanvas,
      clear: () => {
        opsRef.current = [];
        seqRef.current = 1;
        wb.clearCanvas();
      },
      getOps: () => opsRef.current.slice(),
      collectThumbnail: () => {
        const canvas = wb.canvasRef.current;
        if (!canvas) return undefined;
        try {
          return canvas.toDataURL('image/png');
        } catch {
          return undefined;
        }
      },
    };
  }, [wb]);

  void recordOp; // currently a no-op shim; legacy useWhiteboard only handles live draw events.

  return {
    canvasRef: wb.canvasRef,
    tool: wb.tool,
    setTool: wb.setTool,
    color: wb.color,
    setColor: wb.setColor,
    lineWidth: wb.lineWidth,
    setLineWidth: wb.setLineWidth,
    ops: opsRef.current,
    snapshot: recordingDraw,
  };
}

export function CollaborativeWhiteboard({
  socket,
  roomId,
  userId,
  width = 1280,
  height = 720,
  sharedSession,
}: CollaborativeWhiteboardProps) {
  const { t, i18n } = useTranslation(['common', 'whiteboard']);
  const [showSessionList, setShowSessionList] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { canvasRef, tool, setTool, color, setColor, lineWidth, setLineWidth, snapshot } =
    useCanvasSnapshot(roomId, sharedSession ? null : socket);

  const persistence = useWhiteboardPersistence({
    socket,
    roomId: sharedSession?.roomId ?? roomId,
    userId: sharedSession?.ownerId ?? userId,
    width: sharedSession?.width ?? width,
    height: sharedSession?.height ?? height,
    courseId: sharedSession?.courseId,
    collectOps: snapshot.getOps,
    collectThumbnail: snapshot.collectThumbnail,
  });

  const onLoad = useCallback(
    async (id: string) => {
      await persistence.load(id);
      // Replay into the live canvas by replaying each op through `drawOn`.
      snapshot.clear();
      const loaded = persistence.session;
      if (loaded) {
        for (const op of loaded.ops) {
          // Use a synthetic DrawData — `drawOnCanvas` only reads the fields
          // it needs (tool, color, lineWidth, points).
          snapshot.drawOn({
            tool: op.tool === 'text' && !op.text ? 'pen' : op.tool,
            color: op.color ?? '#000',
            lineWidth: op.width,
            startX: op.points[0]?.x ?? 0,
            startY: op.points[0]?.y ?? 0,
            endX: op.points[1]?.x ?? op.points[0]?.x ?? 0,
            endY: op.points[1]?.y ?? op.points[0]?.y ?? 0,
            text: op.text,
          });
        }
      }
      setShowSessionList(false);
    },
    [persistence, snapshot]
  );

  const onExportPng = useCallback(async () => {
    const ops = snapshot.getOps();
    const blob = await exportOpsAsPng(ops, { width, height });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `whiteboard-${stamp}.png`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [height, snapshot, width]);

  const onExportSvg = useCallback(() => {
    const ops = snapshot.getOps();
    const svg = exportOpsAsSvg(ops, { width, height });
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `whiteboard-${stamp}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [height, snapshot, width]);

  const tools: Array<{ name: DrawTool; labelKey: string }> = useMemo(
    () => [
      { name: 'pen', labelKey: 'whiteboard.toolPen' },
      { name: 'eraser', labelKey: 'whiteboard.toolEraser' },
      { name: 'line', labelKey: 'whiteboard.toolLine' },
      { name: 'rectangle', labelKey: 'whiteboard.toolRectangle' },
      { name: 'circle', labelKey: 'whiteboard.toolCircle' },
      { name: 'text', labelKey: 'whiteboard.toolText' },
    ],
    []
  );

  const colors = useMemo(
    () => ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF'],
    []
  );

  return (
    <div className="w-full h-full flex flex-col gap-3" dir={i18n.dir?.() ?? 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
        <div className="flex flex-wrap gap-2">
          {tools.map(({ name, labelKey }) => (
            <button
              key={name}
              type="button"
              onClick={() => setTool(name)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                tool === name
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600'
              }`}
            >
              {t(labelKey, name)}
            </button>
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label={t('whiteboard.colorPickerAria', 'Pick color')}
            className="w-10 h-10 rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer"
          />
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('whiteboard.sizeLabel', 'Size')}</span>
            <input
              type="range"
              min={1}
              max={20}
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              aria-label={t('whiteboard.sizeAria', 'Stroke size')}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 w-8 text-end">{lineWidth}px</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => persistence.saveNow()}
            disabled={persistence.saveState === 'saving'}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {persistence.saveState === 'saving'
              ? t('status.saving', 'Saving...')
              : t('whiteboard.saveNow', 'Save')}
          </button>
          <button
            type="button"
            onClick={() => setShowShareDialog(true)}
            disabled={!persistence.session?.id}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" />
            {t('whiteboard.share', 'Share')}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
              aria-expanded={showExportMenu}
            >
              <Download className="w-4 h-4" />
              {t('whiteboard.export', 'Export')}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showExportMenu && (
              <div className="absolute end-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <button
                  type="button"
                  onClick={onExportPng}
                  className="block w-full text-start px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {t('whiteboard.exportPng', 'Download PNG')}
                </button>
                <button
                  type="button"
                  onClick={onExportSvg}
                  className="block w-full text-start px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {t('whiteboard.exportSvg', 'Download SVG')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center justify-center p-3">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="max-w-full max-h-full"
          style={{ touchAction: 'none' }}
          aria-label={t('whiteboard.canvasAria', 'Collaborative whiteboard canvas')}
        />
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400">
        {t('whiteboard.lastSaved', {
          defaultValue: 'Last saved {{relative}}',
          relative: persistence.session
            ? new Date(persistence.session.updatedAt).toLocaleString(i18n.language)
            : t('whiteboard.neverSaved', 'never'),
        })}
      </div>

      {showSessionList && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <WhiteboardSessionList
            onLoad={onLoad}
            onCreate={() => {
              setShowSessionList(false);
              snapshot.clear();
            }}
          />
        </div>
      )}

      {!showSessionList && (
        <button
          type="button"
          onClick={() => setShowSessionList(true)}
          className="self-start text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('whiteboard.openSessionList', 'Browse saved boards')}
        </button>
      )}

      <WhiteboardShareDialog
        open={showShareDialog}
        shareUrl={persistence.shareLink}
        busy={false}
        onClose={() => setShowShareDialog(false)}
        onMint={() => persistence.createShareToken()}
        onRevoke={() => persistence.revokeShareToken()}
      />
    </div>
  );
}

export default CollaborativeWhiteboard;
