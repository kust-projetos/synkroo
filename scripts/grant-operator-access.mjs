import {
  grantOperatorAccess,
  isMainModule,
  main as runMain,
  parseOperatorArgs,
} from './operator-access-common.mjs';

export const parseArgs = (args = []) => parseOperatorArgs(args, { requireExpiresAt: true });
export { grantOperatorAccess };

if (isMainModule(import.meta.url, process.argv[1])) {
  try {
    await runMain('grant', parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error('ERROR:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
