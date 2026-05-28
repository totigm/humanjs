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
        'Begins recording the session. Every humanized action until human_stop_recording is captured (frames + action timeline). The visible cursor is in the video. One recording per session at a time.',
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
        'Stops the active recording and writes it to HUMANJS_OUTPUT_DIR. The filename extension picks the format: .mp4/.webm = video, .gif = animated gif, .json = action timeline. Path components are rejected for safety.',
      inputSchema: {
        filename: z
          .string()
          .describe('Output filename, e.g. "demo.mp4", "demo.gif", or "demo.json".'),
        session: z.string().optional().describe('Session ID. Omit for the default session.'),
      },
    },
    async ({ filename, session }) => {
      const recording = await sessions.stopRecording(session);
      const path = resolveOutputPath(env.outputDir, filename);
      const ext = extname(filename).toLowerCase();

      let saved: string;
      if (ext === '.gif') {
        saved = await recording.toGif(path);
      } else if (ext === '.json') {
        saved = await recording.toTimeline(path);
      } else if (ext === '.mp4' || ext === '.webm') {
        saved = await recording.toVideo(path);
      } else {
        throw new Error(`Unsupported output extension "${ext}". Use .mp4, .webm, .gif, or .json.`);
      }

      return { content: [{ type: 'text', text: `saved recording to ${saved}` }] };
    },
  );
}
