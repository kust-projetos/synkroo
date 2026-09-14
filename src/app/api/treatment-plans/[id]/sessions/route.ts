/** Transport entrypoint; implementation lives outside the route module. */
import { GET as handlerGET, POST as handlerPOST } from './_handler';
import { withModuleRoute } from '@/core/modules/gates';

export const GET = withModuleRoute('operacional')(handlerGET);
export const POST = withModuleRoute('operacional')(handlerPOST);
