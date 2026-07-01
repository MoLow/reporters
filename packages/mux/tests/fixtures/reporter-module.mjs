export default async function* reporter(source) {
  for await (const event of source) yield `${event.type}\n`;
}
