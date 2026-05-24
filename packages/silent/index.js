// eslint-disable-next-line require-yield
export default async function* silent(source) {
  // eslint-disable-next-line no-unused-vars
  for await (const event of source);
}
