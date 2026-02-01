
import { wecomPlugin } from './extensions/wecom/src/channel.ts';

console.log('WeCom Plugin Metadata:');
console.log(JSON.stringify(wecomPlugin.meta, null, 2));

if (wecomPlugin.meta.label === 'WeCom' && wecomPlugin.meta.id === 'wecom') {
  console.log('VERIFICATION SUCCESS: Metadata is correctly defined.');
} else {
  console.log('VERIFICATION FAILED: Metadata is missing or incorrect.');
  process.exit(1);
}
