import { obj } from '../schema.js';

export default {
  name: 'set_autostash',
  title: 'Set autostash',
  description: 'Turns autostash on or off (as the Files view\'s Session Recovery setting does). Turning it on takes effect the next time a network loads; turning it off stops it immediately. Autostash writes the session to this browser\'s storage every minute.',
  inputSchema: obj({ enabled: { type: 'boolean' } }, ['enabled']),
  untrusted: false,
  // Turning it off stores less, so only turning it on asks
  confirm: args => args.enabled ? 'Turn autostash on: every session loaded from now on would be saved in this browser each minute, until it is turned off.' : null,
  execute: async (args) => {
    self.MT.setAutostash(args.enabled);
    return { autostash: !!args.enabled };
  }
};
