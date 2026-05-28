/**
 * Recording tools — capture a humanized session to video / gif / timeline.
 *
 * `human.record()` is callback-based, so these reshape it into start/stop:
 * `human_start_recording` opens capture, every humanized action in between
 * is recorded, `human_stop_recording` finalizes and writes the file. The
 * stop-signal plumbing lives in SessionManager; these tools just drive it
 * and pick the output format from the filename extension.
 */

import { extname } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolContext } from '../context';
import { resolveOutputPath } from '../output';

export function registerRecordingTools(server: McpServer, { sessions, env }: ToolContext): void {
  server.registerTool(
    'human_start_recording',
    {
      title: 'Start recording',
      description:
        'Begins recording the session. Every humanized action until human_stop_recording is captured (frames + action timeline). The visible cursor is in the video. One recording per session at a time. For a natural-looking take, explore the flow first to find correct selectors, then record one clean back-to-back run — keep selector-guessing out of the recording.',
      inputSchema: {
        name: z
          .string()
          .optional()
          .describe('Label for the recording (used in the timeline + the fallback filename).'),
        video: z
          .boolean()
          .optional()
          .describe('Capture video frames. Default true. Set false for a timeline-only recording.'),
        quality: z
          .enum(['fast', 'standard', 'high', 'lossless'])
          .optional()
          .describe('Capture/encode quality. Default "high" (1080p, visually lossless).'),
        session: z.string().optional().describe('Session ID. Omit for the default session.'),
      },
    },
    async ({ name, video, quality, session }) => {
      await sessions.startRecording(session, { name, video, quality });
      return {
        content: [{ type: 'text', text: `recording started${name ? ` ("${name}")` : ''}` }],
      };
    },
  );

  server.registerTool(
    'human_stop_recording',
    {
      title: 'Stop recording and save',
      description:
        'Stops the active recording and writes it to one or more files in HUMANJS_OUTPUT_DIR. Each filename\'s extension picks its format: .mp4/.webm = video, .gif = animated gif, .json = action timeline. Pass several to export the same recording multiple ways, e.g. ["demo.mp4", "demo.json"] for video + timeline. Path components are rejected for safety. If the final action navigated, confirm the destination rendered (e.g. human_screenshot) before stopping — a click resolves on dispatch, not after navigation, so stopping too early cuts the video short.',
      inputSchema: {
        filenames: z
          .array(z.string())
          .min(1)
          .describe(
            'One or more output filenames. The recording is saved to each, format chosen by extension. e.g. ["demo.mp4"] or ["demo.mp4", "demo.gif", "demo.json"].',
          ),
        session: z.string().optional().describe('Session ID. Omit for the default session.'),
      },
    },
    async ({ filenames, session }) => {
      // Resolve + validate every path/format BEFORE stopping, so a bad
      // filename doesn't leave the recording stopped-but-unsaved.
      const targets = filenames.map((filename) => ({
        path: resolveOutputPath(env.outputDir, filename),
        ext: extname(filename).toLowerCase(),
      }));
      for (const { ext } of targets) {
        if (ext !== '.mp4' && ext !== '.webm' && ext !== '.gif' && ext !== '.json') {
          throw new Error(
            `Unsupported output extension "${ext}". Use .mp4, .webm, .gif, or .json.`,
          );
        }
      }

      const recording = await sessions.stopRecording(session);
      try {
        const saved: string[] = [];
        for (const { path, ext } of targets) {
          // Video/gif read the captured frames; timeline reads in-memory
          // events. All are repeatable and interleavable until dispose().
          if (ext === '.gif') saved.push(await recording.toGif(path));
          else if (ext === '.json') saved.push(await recording.toTimeline(path));
          else saved.push(await recording.toVideo(path));
        }
        return { content: [{ type: 'text', text: `saved recording to:\n${saved.join('\n')}` }] };
      } finally {
        // Free the captured-frames temp dir now that all exports are done.
        await recording.dispose();
      }
    },
  );
}
