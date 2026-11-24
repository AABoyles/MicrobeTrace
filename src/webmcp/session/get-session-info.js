import { obj } from '../schema.js';
import { summary } from './helpers.js';

export default {
  name: 'get_session_info',
  title: 'Get session info',
  description: 'Describes the current session: whether a network is loaded, node/link/cluster counts, fields, distance metric and threshold, how long it took to load, which files were loaded (name, format, columns), whether it has sequences, the open views, the loading log, the MicrobeTrace version, and whether autostash is on. Cheap; call it first to see what state the app is in.',
  inputSchema: obj({}),
  annotations: { readOnlyHint: true },
  execute: async () => {
    const s = self.session;
    const autostash = await self.db.getItem('stash-auto');
    return Object.assign(summary(), {
      version: self.MT.manifest ? self.MT.manifest.version : null,
      files: s.files.map(f => ({ name: f.name, extension: f.extension, format: f.format, field1: f.field1, field2: f.field2, field3: f.field3 })),
      nodeExclusions: s.data.nodeExclusions.slice(),
      filesViewOpen: !!self.MT.filesView,
      autostash: autostash == 'true',
      startedAt: s.meta.readyTime ? new Date(s.meta.readyTime).toISOString() : null
    });
  }
};
