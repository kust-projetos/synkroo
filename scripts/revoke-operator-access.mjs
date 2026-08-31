import {
  isMainModule,
  main as runMain,
  parseOperatorArgs,
  revokeOperatorAccess,
} from './operator-access-common.mjs';

export const parseArgs = (args = []) => parseOperatorArgs(args);
export { revokeOperatorAccess };

if (isMainModule(import.meta.url, process.argv[1])) {
  try {
    await runMain('revoke', parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error('ERROR:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
