# @humanjs/recorder

One-call session recording for [HumanJS](https://humanjs.dev). See the [recording section in `@humanjs/playwright`](../playwright#recording) for full docs.

```ts
import { record } from '@humanjs/recorder';

await record({ output: 'demo.mp4' }, async (human) => {
  await human.click('#login');
});
```

## License

MIT
