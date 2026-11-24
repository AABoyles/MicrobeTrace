// WebMCP tools for loading data and managing sessions: adding files and
// choosing how each is read, the loading options, launching, the demo,
// opening and saving sessions, stashes, and the sequence audit.
// (See src/webmcp.js. Files are added through MT.filesView, which the Files
// view, components/files.html, provides while it is open.)

import addFile from './add-file.js';
import listPendingFiles from './list-pending-files.js';
import updatePendingFile from './update-pending-file.js';
import removePendingFile from './remove-pending-file.js';
import reorderPendingFiles from './reorder-pending-files.js';
import getLoadingOptions from './get-loading-options.js';
import setLoadingOptions from './set-loading-options.js';
import launch from './launch.js';
import loadDemo from './load-demo.js';
import generateSequences from './generate-sequences.js';
import openSession from './open-session.js';
import getSessionJson from './get-session-json.js';
import saveSession from './save-session.js';
import newSession from './new-session.js';
import getSessionInfo from './get-session-info.js';
import listStashes from './list-stashes.js';
import stashSession from './stash-session.js';
import recallStash from './recall-stash.js';
import deleteStash from './delete-stash.js';
import getAutostash from './get-autostash.js';
import setAutostash from './set-autostash.js';
import auditSequences from './audit-sequences.js';
import excludeSequences from './exclude-sequences.js';

// In the order the tools are listed to an agent
export default [
  addFile,
  listPendingFiles,
  updatePendingFile,
  removePendingFile,
  reorderPendingFiles,
  getLoadingOptions,
  setLoadingOptions,
  launch,
  loadDemo,
  generateSequences,
  openSession,
  getSessionJson,
  saveSession,
  newSession,
  getSessionInfo,
  listStashes,
  stashSession,
  recallStash,
  deleteStash,
  getAutostash,
  setAutostash,
  auditSequences,
  excludeSequences,
];
