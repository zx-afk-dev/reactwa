import { createCrudHandler } from '../../../../lib/firestoreCrud';
export default createCrudHandler('vipKeys', { idPrefix: 'VIP', idLength: 12 });
