import { createCrudHandler } from '../../../../lib/firestoreCrud';
export default createCrudHandler('promotions', { idPrefix: 'PROMO', idLength: 6 });
