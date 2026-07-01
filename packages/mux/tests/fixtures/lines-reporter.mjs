export default async function* lines(source) {
  for await (const event of source) {
    yield `${event.type}\n`;
  }
}
