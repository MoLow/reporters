import { inspect } from 'node:util';

export default async function* bail(source) {
  for await (const event of source) {
    if (event.type === 'test:fail') {
      /* c8 ignore start */
      // The run is aborted before any other reporter can print its failure
      // summary, so print the error that caused the bail ourselves.
      const { error } = event.data.details ?? {};
      const cause = error?.code === 'ERR_TEST_FAILURE' ? error.cause : error;
      const details = cause === undefined ? '' : `${inspect(cause).replace(/^/gm, '  ')}\n`;
      yield `\n\u001b[31m✖ Bailing on failed test: ${event.data.name}\u001b[0m\n${details}`;
      throw new Error('Bail');
    }
    /* c8 ignore stop */
  }
}
