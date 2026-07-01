import { httpServer } from '@reporters/web/sink';
import live from '@reporters/live';

export default {
  local: [
    { reporter: live, sink: 'stdout' },
    { reporter: '@reporters/web', sink: httpServer() },
  ],
  ci: [
    { reporter: '@reporters/gh', sink: 'stdout' },
  ],
};
